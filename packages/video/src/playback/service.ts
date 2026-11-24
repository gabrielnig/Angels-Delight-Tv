import { Forbidden, NotFound, Unauthorized, type Actor, isStaffRole } from '@ad/shared';
import type { StorageAdapter } from '@ad/storage';
import { unwrapHlsKey, type Keyring } from '../hls-key';
import {
  PLAYBACK_TOKEN_SECONDS,
  PREVIEW_TOKEN_SECONDS,
  issuePlaybackToken,
  verifyPlaybackToken,
  type PlaybackClaims,
  type SecretRing,
} from '../playback-token';
import { rewriteMaster, rewriteVariant } from '../playlist';
import { signedMediaUrl } from '../signing';

export interface PlayableVideo {
  id: string;
  mediaPrefix: string;
  status: string;
  publishState: string;
  publishAt: Date | null;
  kidsSafe: boolean;
  /** Maturity rank 0 (G) to 4 (18). Null or absent means unrated: it counts as kids safe only when the flag says so. */
  maturityRank?: number | null;
  deletedAt: Date | null;
}

/** The profile limit check (M44-S20). No limit, or 4, allows everything. Unrated titles fail closed. */
export function withinMaturityLimit(video: PlayableVideo, limit: number | undefined): boolean {
  if (limit === undefined || limit >= 4) return true;
  const rank = video.maturityRank ?? (video.kidsSafe ? 0 : 4);
  return rank <= limit;
}

export interface PublicCaption {
  language: string;
  label: string;
  isDefault: boolean;
  key: string;
}

/** Everything the service needs from the database, so the rules are testable without one. */
export interface PlaybackStore {
  video(videoId: string): Promise<PlayableVideo | null>;
  /** The profile only when it belongs to the account. */
  profile(
    profileId: string,
    accountId: string,
  ): Promise<{ id: string; isKids: boolean; maxMaturityRank?: number } | null>;
  wrappedKey(videoId: string): Promise<Uint8Array | null>;
  captions(videoId: string): Promise<PublicCaption[]>;
  /** Key of the seek preview map under the media origin, or null when none was made. */
  spriteKey(videoId: string): Promise<string | null>;
}

/** Structural match for `RateLimiter.enforce` in @ad/security, which throws RateLimited when denied. */
export interface PlaybackLimiter {
  enforce(
    policy: { name: string; capacity: number; refillPerSecond: number },
    subject: string,
  ): Promise<unknown>;
}

const perMinutes = (name: string, capacity: number, minutes: number) => ({
  name,
  capacity,
  refillPerSecond: capacity / (minutes * 60),
});

/** ARCHITECTURE section 11. Constants so tests pin them and a change is reviewed in one place. */
/** How long signed segment urls last. Past it the player fetches a fresh playlist on its own (D-120). */
export const SEGMENT_URL_SECONDS = 2 * 3600;

/** Guest segment urls are short lived (D-G5): a shared guest url stops working within 20 minutes by default. */
export const GUEST_SEGMENT_URL_SECONDS = 20 * 60;

export const PLAY_POLICIES = {
  /** 20 sessions a minute per guest id (M40-S11 AC1). */
  sessionGuest: perMinutes('play-session-guest', 20, 1),
  /** 120 a minute per address, generous because mobile networks share addresses (M40-S11 AC2). */
  sessionGuestIp: perMinutes('play-session-guest-ip', 120, 1),
  sessionProfile: perMinutes('play-session-profile', 60, 1),
  keyProfile: perMinutes('play-key-profile', 20, 10),
  keyIp: perMinutes('play-key-ip', 300, 1),
};

export interface PlaybackDeps {
  store: PlaybackStore;
  /** Holds `templates/{id}/...`. */
  originals: Pick<StorageAdapter, 'get'>;
  tokens: SecretRing;
  mediaSecret: Uint8Array;
  keyring: Keyring;
  limiter?: PlaybackLimiter;
  appOrigin: string;
  /** Origin that serves `v/`, `cap/` and `img/`: the edge worker, or the dev media route. */
  mediaOrigin: string;
  /** How long signed segment urls last. Defaults to 2 hours. An expired url is refreshed by the player (D-120). */
  segmentTtlSeconds?: number;
  /** How long signed segment urls last for guest tokens. Defaults to 20 minutes (`limits.guest_segment_minutes`). */
  guestSegmentTtlSeconds?: number | (() => number | Promise<number>);
  /** Highest maturity rank a guest may play (`maturity.guest_max_rank`). Absent means no ceiling. Kids mode is always 0. */
  guestMaxRank?: number | (() => number | Promise<number>);
  now?: () => number;
}

export interface SessionInfo {
  token: string;
  expiresAt: string;
  masterUrl: string;
  captions: { language: string; label: string; isDefault: boolean; url: string }[];
  /** WebVTT map for seek preview thumbnails, or null. */
  sprite: string | null;
  preview: boolean;
}

const HEIGHT = /^\d{3,4}$/;

async function readAll(stream: AsyncIterable<unknown>): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk as Uint8Array));
  return Buffer.concat(chunks).toString('utf8');
}

export class PlaybackService {
  private readonly now: () => number;

  constructor(private readonly deps: PlaybackDeps) {
    this.now = deps.now ?? (() => Date.now() / 1000);
  }

  private isLive(video: PlayableVideo): boolean {
    if (video.deletedAt || video.status !== 'ready') return false;
    if (video.publishState === 'published') return true;
    return (
      video.publishState === 'scheduled' &&
      video.publishAt !== null &&
      video.publishAt.getTime() / 1000 <= this.now()
    );
  }

  private async captionList(videoId: string): Promise<SessionInfo['captions']> {
    const origin = this.deps.mediaOrigin.replace(/\/+$/, '');
    return (await this.deps.store.captions(videoId)).map((c) => ({
      language: c.language,
      label: c.label,
      isDefault: c.isDefault,
      url: `${origin}/${c.key}`,
    }));
  }

  private async spriteUrl(videoId: string): Promise<string | null> {
    const key = await this.deps.store.spriteKey(videoId);
    return key ? `${this.deps.mediaOrigin.replace(/\/+$/, '')}/${key}` : null;
  }

  private async session(
    videoId: string,
    token: string,
    seconds: number,
    preview: boolean,
  ): Promise<SessionInfo> {
    const origin = this.deps.appOrigin.replace(/\/+$/, '');
    return {
      token,
      expiresAt: new Date((Math.floor(this.now()) + seconds) * 1000).toISOString(),
      masterUrl: `${origin}/api/play/${videoId}/master.m3u8`,
      captions: await this.captionList(videoId),
      sprite: await this.spriteUrl(videoId),
      preview,
    };
  }

  /** A viewer session. Unpublished, deleted and not kids safe titles are all a plain not found. */
  async startSession(
    viewer: {
      accountId: string;
      profileId: string;
      activeProfileId?: string;
      /** The session is locked to a kids profile (server side). Only `activeProfileId` may be used. */
      kidsLocked?: boolean;
    },
    videoId: string,
  ): Promise<SessionInfo> {
    if (viewer.kidsLocked && viewer.activeProfileId !== viewer.profileId)
      throw new Forbidden('That profile is not available.');
    // The signed active profile cookie wins over a profile id the client names: a kids profile cannot ask for a grown-up one.
    if (viewer.activeProfileId && viewer.activeProfileId !== viewer.profileId) {
      const active = await this.deps.store.profile(viewer.activeProfileId, viewer.accountId);
      if (active?.isKids) throw new Forbidden('That profile is not available.');
    }
    const profile = await this.deps.store.profile(viewer.profileId, viewer.accountId);
    if (!profile) throw new Forbidden('That profile is not available.');
    await this.deps.limiter?.enforce(PLAY_POLICIES.sessionProfile, profile.id);
    const video = await this.deps.store.video(videoId);
    if (
      !video ||
      !this.isLive(video) ||
      (profile.isKids && !video.kidsSafe) ||
      !withinMaturityLimit(video, profile.isKids ? 0 : profile.maxMaturityRank)
    )
      throw new NotFound('This video is not available.');
    const token = issuePlaybackToken(this.deps.tokens, {
      videoId,
      accountId: viewer.accountId,
      profileId: profile.id,
      now: this.now,
    });
    return this.session(videoId, token, PLAYBACK_TOKEN_SECONDS, false);
  }

  /**
   * A guest session: no account, a published and ready video only. `kids` is the device Kids mode, a convenience
   * and not a lock, but the query rule is the same as for a kids profile. The guest id is the limiter subject and
   * the address is a second one, so shared mobile networks are not punished by one noisy guest.
   */
  async startGuestSession(
    guest: { guestId: string; kids: boolean; ip?: string },
    videoId: string,
  ): Promise<SessionInfo> {
    await this.deps.limiter?.enforce(PLAY_POLICIES.sessionGuest, guest.guestId);
    if (guest.ip) await this.deps.limiter?.enforce(PLAY_POLICIES.sessionGuestIp, guest.ip);
    const video = await this.deps.store.video(videoId);
    if (
      !video ||
      !this.isLive(video) ||
      (guest.kids && !video.kidsSafe) ||
      !withinMaturityLimit(video, await this.guestLimit(guest.kids))
    )
      throw new NotFound('This video is not available.');
    const token = issuePlaybackToken(this.deps.tokens, {
      videoId,
      accountId: guest.guestId,
      guest: true,
      kids: guest.kids,
      now: this.now,
    });
    return this.session(videoId, token, PLAYBACK_TOKEN_SECONDS, false);
  }

  /** The rank limit of a guest: 0 in Kids mode, else the configured ceiling, else none. */
  private async guestLimit(kids: boolean): Promise<number | undefined> {
    if (kids) return 0;
    const ceiling = this.deps.guestMaxRank;
    return typeof ceiling === 'function' ? await ceiling() : ceiling;
  }

  /** Admin preview: any non deleted video that finished encoding, no profile, no analytics. */
  async startPreview(actor: Actor, videoId: string): Promise<SessionInfo> {
    if (!isStaffRole(actor.role)) throw new Forbidden('Previews are for staff.');
    const video = await this.deps.store.video(videoId);
    if (!video || video.deletedAt || video.status !== 'ready')
      throw new NotFound('This video is not ready to preview.');
    const token = issuePlaybackToken(this.deps.tokens, {
      videoId,
      accountId: actor.accountId,
      preview: true,
      now: this.now,
    });
    return this.session(videoId, token, PREVIEW_TOKEN_SECONDS, true);
  }

  /** Verifies the token for this video and that the video is still watchable right now. */
  async authorize(token: string | null, videoId: string): Promise<PlaybackClaims> {
    if (!token) throw new Unauthorized('Playback token required');
    const verdict = verifyPlaybackToken(this.deps.tokens, token, { videoId, now: this.now });
    if (!verdict.ok) {
      if (verdict.reason === 'wrong_video') throw new Forbidden('Token is for another video');
      throw new Unauthorized(
        verdict.reason === 'expired' ? 'Playback token expired' : 'Invalid playback token',
      );
    }
    const video = await this.deps.store.video(videoId);
    const watchable = video && !video.deletedAt && video.status === 'ready';
    if (!watchable || (!verdict.claims.pv && !this.isLive(video)))
      throw new NotFound('This video is not available.');
    return verdict.claims;
  }

  private query(token: string, viaQuery: boolean): string | undefined {
    return viaQuery ? `pt=${encodeURIComponent(token)}` : undefined;
  }

  private async template(videoId: string, name: string): Promise<string> {
    try {
      return await readAll(await this.deps.originals.get(`templates/${videoId}/${name}`));
    } catch {
      throw new NotFound('Playlist not found.');
    }
  }

  async master(token: string | null, videoId: string, viaQuery = false): Promise<string> {
    await this.authorize(token, videoId);
    return rewriteMaster(await this.template(videoId, 'master.m3u8'), {
      videoId,
      appOrigin: this.deps.appOrigin,
      query: this.query(token as string, viaQuery),
    });
  }

  async variant(
    token: string | null,
    videoId: string,
    height: string,
    viaQuery = false,
  ): Promise<string> {
    if (!HEIGHT.test(height)) throw new NotFound('Playlist not found.');
    const claims = await this.authorize(token, videoId);
    const video = (await this.deps.store.video(videoId)) as PlayableVideo;
    const template = await this.template(videoId, `${height}.m3u8`);
    const guestTtl = this.deps.guestSegmentTtlSeconds;
    const ttl = claims.gst
      ? ((typeof guestTtl === 'function' ? await guestTtl() : guestTtl) ??
        GUEST_SEGMENT_URL_SECONDS)
      : (this.deps.segmentTtlSeconds ?? SEGMENT_URL_SECONDS);
    const exp = Math.floor(this.now()) + ttl;
    return rewriteVariant(template, {
      videoId,
      appOrigin: this.deps.appOrigin,
      keyQuery: this.query(token as string, viaQuery),
      segmentUrl: (name) =>
        signedMediaUrl({
          origin: this.deps.mediaOrigin,
          key: `v/${video.mediaPrefix}/${height}/${name}`,
          secret: this.deps.mediaSecret,
          exp,
        }),
    });
  }

  /** The raw 16 byte AES key. Always rate limited, and re-checks the profile for kids rules. */
  async key(token: string | null, videoId: string, ip: string): Promise<Uint8Array> {
    const claims = await this.authorize(token, videoId);
    await this.deps.limiter?.enforce(PLAY_POLICIES.keyIp, ip);
    await this.deps.limiter?.enforce(PLAY_POLICIES.keyProfile, claims.pid ?? claims.aid);
    if (claims.gst) {
      // Guests have no profile row. The Kids mode claim is re-checked against the video as it is now.
      const video = (await this.deps.store.video(videoId)) as PlayableVideo;
      if (
        (claims.kd && !video.kidsSafe) ||
        !withinMaturityLimit(video, await this.guestLimit(Boolean(claims.kd)))
      )
        throw new NotFound('This video is not available.');
    } else if (claims.pid) {
      const profile = await this.deps.store.profile(claims.pid, claims.aid);
      const video = (await this.deps.store.video(videoId)) as PlayableVideo;
      if (
        !profile ||
        (profile.isKids && !video.kidsSafe) ||
        !withinMaturityLimit(video, profile.isKids ? 0 : profile.maxMaturityRank)
      )
        throw new NotFound('This video is not available.');
    }
    const wrapped = await this.deps.store.wrappedKey(videoId);
    if (!wrapped) throw new NotFound('This video is not available.');
    return unwrapHlsKey(this.deps.keyring, videoId, wrapped);
  }
}
