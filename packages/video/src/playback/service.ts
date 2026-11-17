import { Forbidden, NotFound, Unauthorized, type Actor } from '@ad/shared';
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
  deletedAt: Date | null;
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
  profile(profileId: string, accountId: string): Promise<{ id: string; isKids: boolean } | null>;
  wrappedKey(videoId: string): Promise<Uint8Array | null>;
  captions(videoId: string): Promise<PublicCaption[]>;
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
export const PLAY_POLICIES = {
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
  /** How long signed segment urls last. A VOD playlist is fetched once, so this must cover a full watch. */
  segmentTtlSeconds?: number;
  now?: () => number;
}

export interface SessionInfo {
  token: string;
  expiresAt: string;
  masterUrl: string;
  captions: { language: string; label: string; isDefault: boolean; url: string }[];
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
      preview,
    };
  }

  /** A viewer session. Unpublished, deleted and not kids safe titles are all a plain not found. */
  async startSession(
    viewer: { accountId: string; profileId: string },
    videoId: string,
  ): Promise<SessionInfo> {
    const profile = await this.deps.store.profile(viewer.profileId, viewer.accountId);
    if (!profile) throw new Forbidden('That profile is not available.');
    await this.deps.limiter?.enforce(PLAY_POLICIES.sessionProfile, profile.id);
    const video = await this.deps.store.video(videoId);
    if (!video || !this.isLive(video) || (profile.isKids && !video.kidsSafe))
      throw new NotFound('This video is not available.');
    const token = issuePlaybackToken(this.deps.tokens, {
      videoId,
      accountId: viewer.accountId,
      profileId: profile.id,
      now: this.now,
    });
    return this.session(videoId, token, PLAYBACK_TOKEN_SECONDS, false);
  }

  /** Admin preview: any non deleted video that finished encoding, no profile, no analytics. */
  async startPreview(actor: Actor, videoId: string): Promise<SessionInfo> {
    if (actor.role !== 'admin' && actor.role !== 'editor')
      throw new Forbidden('Previews are for staff.');
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
    await this.authorize(token, videoId);
    const video = (await this.deps.store.video(videoId)) as PlayableVideo;
    const template = await this.template(videoId, `${height}.m3u8`);
    const exp = Math.floor(this.now()) + (this.deps.segmentTtlSeconds ?? 6 * 3600);
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
    if (claims.pid) {
      const profile = await this.deps.store.profile(claims.pid, claims.aid);
      const video = (await this.deps.store.video(videoId)) as PlayableVideo;
      if (!profile || (profile.isKids && !video.kidsSafe))
        throw new NotFound('This video is not available.');
    }
    const wrapped = await this.deps.store.wrappedKey(videoId);
    if (!wrapped) throw new NotFound('This video is not available.');
    return unwrapHlsKey(this.deps.keyring, videoId, wrapped);
  }
}
