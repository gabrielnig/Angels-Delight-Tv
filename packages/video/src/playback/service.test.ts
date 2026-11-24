import { Forbidden, NotFound, RateLimited, Unauthorized } from '@ad/shared';
import { Readable } from 'node:stream';
import { describe, expect, it } from 'vitest';
import { generateHlsKey, keyring, wrapHlsKey } from '../hls-key';
import { secretRing } from '../playback-token';
import { buildMasterTemplate, buildVariantTemplate } from '../playlist';
import { verifyMediaSignature } from '../signing';
import {
  PLAY_POLICIES,
  PlaybackService,
  GUEST_SEGMENT_URL_SECONDS,
  SEGMENT_URL_SECONDS,
  type PlayableVideo,
  type PlaybackStore,
} from './service';

const VID = '0192f0a0-0000-7000-8000-0000000000aa';
const PROFILE = '0192f0a0-0000-7000-8000-0000000000b1';
const ADULT = '0192f0a0-0000-7000-8000-0000000000b2';
const ACCOUNT = '0192f0a0-0000-7000-8000-0000000000c1';
const mediaSecret = new Uint8Array(32).fill(3);
const kek = new Uint8Array(32).fill(9);
const hlsKey = generateHlsKey();

const baseVideo: PlayableVideo = {
  id: VID,
  mediaPrefix: 'abcdefghijklmnopqrstuvwx',
  status: 'ready',
  publishState: 'published',
  publishAt: null,
  kidsSafe: true,
  deletedAt: null,
};

function setup(
  over: {
    video?: Partial<PlayableVideo> | null;
    kids?: boolean;
    maxRank?: number;
    limiter?: unknown;
    sprite?: string | null;
    guestTtl?: number;
    guestMaxRank?: number | (() => number | Promise<number>);
  } = {},
) {
  let clock = 1_800_000_000;
  const video = over.video === null ? null : { ...baseVideo, ...over.video };
  const store: PlaybackStore = {
    video: async () => video,
    profile: async (id, account) =>
      account !== ACCOUNT
        ? null
        : id === PROFILE
          ? { id, isKids: over.kids ?? false, maxMaturityRank: over.maxRank }
          : id === ADULT
            ? { id, isKids: false }
            : null,
    wrappedKey: async () => wrapHlsKey(keyring(kek), VID, hlsKey).keyWrapped,
    captions: async () => [
      { language: 'en', label: 'English', isDefault: true, key: `cap/abc/en.vtt` },
    ],
    spriteKey: async () =>
      over.sprite === undefined ? 'cap/abc/sprites/map-1234abcd.vtt' : over.sprite,
  };
  const files: Record<string, string> = {
    [`templates/${VID}/master.m3u8`]: buildMasterTemplate([
      {
        height: 720,
        width: 1280,
        bandwidthBps: 2_000_000,
        avgBandwidthBps: 1_500_000,
        codecs: 'avc1.4d401f,mp4a.40.2',
      },
    ]),
    [`templates/${VID}/720.m3u8`]: buildVariantTemplate({
      videoId: VID,
      segments: [{ name: 'seg_00001.ts', seconds: 6 }],
    } as never),
  };
  const service = new PlaybackService({
    store,
    originals: {
      get: async (key: string) => {
        const text = files[key];
        if (text === undefined) throw new Error('missing');
        return Readable.from([Buffer.from(text)]);
      },
    },
    tokens: secretRing(new Uint8Array(32).fill(5)),
    mediaSecret,
    keyring: keyring(kek),
    limiter: over.limiter as never,
    appOrigin: 'https://app.example',
    mediaOrigin: 'https://media.example',
    ...(over.guestTtl ? { guestSegmentTtlSeconds: over.guestTtl } : {}),
    ...(over.guestMaxRank !== undefined ? { guestMaxRank: over.guestMaxRank } : {}),
    now: () => clock,
  });
  return { service, advance: (s: number) => (clock += s), clock: () => clock };
}

const viewer = { accountId: ACCOUNT, profileId: PROFILE };

describe('PlaybackService kids gate', () => {
  it('refuses any profile but the locked one when the session is kids locked, even with no active id', async () => {
    const { service } = setup({ kids: true });
    await expect(
      service.startSession({ accountId: ACCOUNT, profileId: ADULT, kidsLocked: true }, VID),
    ).rejects.toBeInstanceOf(Forbidden);
    await expect(
      service.startSession(
        { accountId: ACCOUNT, profileId: PROFILE, activeProfileId: PROFILE, kidsLocked: true },
        VID,
      ),
    ).resolves.toBeTruthy();
  });

  it('refuses a session for another profile while the active profile is a kids profile', async () => {
    const { service } = setup({ kids: true });
    await expect(
      service.startSession({ accountId: ACCOUNT, profileId: ADULT, activeProfileId: PROFILE }, VID),
    ).rejects.toBeInstanceOf(Forbidden);
  });

  it('allows the named profile when the active profile is a grown-up one', async () => {
    const { service } = setup({ kids: false });
    await expect(
      service.startSession({ accountId: ACCOUNT, profileId: ADULT, activeProfileId: PROFILE }, VID),
    ).resolves.toBeTruthy();
  });
});

describe('PlaybackService maturity limit', () => {
  it('refuses a session and a key for a title above the profile limit, and unrated titles', async () => {
    const above = setup({ maxRank: 2, video: { maturityRank: 3 } });
    await expect(above.service.startSession(viewer, VID)).rejects.toBeInstanceOf(NotFound);
    const unrated = setup({ maxRank: 2, video: { maturityRank: null, kidsSafe: false } });
    await expect(unrated.service.startSession(viewer, VID)).rejects.toBeInstanceOf(NotFound);
    const within = setup({ maxRank: 2, video: { maturityRank: 2 } });
    const { token } = await within.service.startSession(viewer, VID);
    await expect(within.service.key(token, VID, '1.1.1.1')).resolves.toBeTruthy();
  });

  it('does not filter a profile at the top of the ladder', async () => {
    const { service } = setup({ maxRank: 4, video: { maturityRank: 4 } });
    await expect(service.startSession(viewer, VID)).resolves.toBeTruthy();
  });

  it('re-checks the limit at key time, so a lowered limit stops an open session', async () => {
    let limit = 4;
    const ctl = setup({ video: { maturityRank: 3 } });
    const { token } = await ctl.service.startSession(viewer, VID);
    limit = 2;
    const lowered = setup({ maxRank: limit, video: { maturityRank: 3 } });
    const issued = await lowered.service.startSession({ ...viewer }, VID).catch(() => null);
    expect(issued).toBeNull();
    await expect(ctl.service.key(token, VID, '1.1.1.1')).resolves.toBeTruthy();
  });
});

describe('PlaybackService sessions', () => {
  it('issues a token, master url and public caption urls for a published video', async () => {
    const { service } = setup();
    const s = await service.startSession(viewer, VID);
    expect(s.masterUrl).toBe(`https://app.example/api/play/${VID}/master.m3u8`);
    expect(s.captions[0]?.url).toBe('https://media.example/cap/abc/en.vtt');
    expect(s.preview).toBe(false);
  });

  it('lists the seek preview map on the media origin, or null when there is none', async () => {
    const withSprite = await setup().service.startSession(viewer, VID);
    expect(withSprite.sprite).toBe('https://media.example/cap/abc/sprites/map-1234abcd.vtt');
    const without = await setup({ sprite: null }).service.startSession(viewer, VID);
    expect(without.sprite).toBeNull();
  });

  it.each([
    ['draft', { publishState: 'draft' }],
    ['deleted', { deletedAt: new Date() }],
    ['processing', { status: 'processing' }],
    [
      'scheduled in the future',
      { publishState: 'scheduled', publishAt: new Date(1_900_000_000_000) },
    ],
  ])('treats a %s video as not found', async (_n, patch) => {
    const { service } = setup({ video: patch });
    await expect(service.startSession(viewer, VID)).rejects.toBeInstanceOf(NotFound);
  });

  it('allows a scheduled video once its time has passed', async () => {
    const { service } = setup({
      video: { publishState: 'scheduled', publishAt: new Date(1_700_000_000_000) },
    });
    await expect(service.startSession(viewer, VID)).resolves.toBeTruthy();
  });

  it('hides non kids safe videos from kids profiles', async () => {
    const { service } = setup({ kids: true, video: { kidsSafe: false } });
    await expect(service.startSession(viewer, VID)).rejects.toBeInstanceOf(NotFound);
  });

  it('refuses a profile from another account', async () => {
    const { service } = setup();
    await expect(
      service.startSession({ accountId: 'other', profileId: PROFILE }, VID),
    ).rejects.toBeInstanceOf(Forbidden);
  });

  it('rate limits session minting per profile', async () => {
    const seen: string[] = [];
    const limiter = {
      enforce: async (policy: { name: string }, subject: string) => {
        seen.push(`${policy.name}:${subject}`);
        throw new RateLimited(10);
      },
    };
    const { service } = setup({ limiter });
    await expect(service.startSession(viewer, VID)).rejects.toBeInstanceOf(RateLimited);
    expect(seen).toEqual([`${PLAY_POLICIES.sessionProfile.name}:${PROFILE}`]);
  });

  it('previews need staff and ignore the publish state', async () => {
    const { service } = setup({ video: { publishState: 'draft' } });
    const s = await service.startPreview({ accountId: ACCOUNT, role: 'editor' }, VID);
    expect(s.preview).toBe(true);
    await expect(
      service.startPreview({ accountId: ACCOUNT, role: 'viewer' }, VID),
    ).rejects.toBeInstanceOf(Forbidden);
    await expect(service.master(s.token, VID)).resolves.toContain('#EXTM3U');
  });
});

describe('PlaybackService playlists and key', () => {
  it('signs segment urls for 2 hours by default (M31-S01 AC1, L-3)', async () => {
    const { service, clock } = setup();
    const { token } = await service.startSession(viewer, VID);
    const variant = await service.variant(token, VID, '720');
    const line = variant.split('\n').find((l) => l.includes('seg_00001.ts'))!;
    const exp = Number(new URL(line).searchParams.get('exp'));
    expect(exp).toBe(Math.floor(clock()) + 2 * 3600);
    expect(SEGMENT_URL_SECONDS).toBe(7200);
  });

  it('rewrites the master and the variant with signed segment urls', async () => {
    const { service, clock } = setup();
    const { token } = await service.startSession(viewer, VID);
    const master = await service.master(token, VID);
    expect(master).toContain(`https://app.example/api/play/${VID}/720.m3u8`);
    const variant = await service.variant(token, VID, '720');
    expect(variant).toContain(`URI="https://app.example/api/hls/keys/${VID}"`);
    const line = variant.split('\n').find((l) => l.includes('seg_00001.ts'))!;
    const url = new URL(line);
    expect(url.origin).toBe('https://media.example');
    expect(url.pathname).toBe('/v/abcdefghijklmnopqrstuvwx/720/seg_00001.ts');
    expect(
      verifyMediaSignature(
        mediaSecret,
        url.pathname.slice(1),
        Number(url.searchParams.get('exp')),
        url.searchParams.get('sig')!,
        clock(),
      ),
    ).toBe(true);
  });

  it('carries the token in the query for native HLS clients', async () => {
    const { service } = setup();
    const { token } = await service.startSession(viewer, VID);
    expect(await service.master(token, VID, true)).toContain(
      `720.m3u8?pt=${encodeURIComponent(token)}`,
    );
    expect(await service.variant(token, VID, '720', true)).toContain(`keys/${VID}?pt=`);
  });

  it('rejects missing, expired and wrong video tokens', async () => {
    const { service, advance } = setup();
    const { token } = await service.startSession(viewer, VID);
    await expect(service.master(null, VID)).rejects.toBeInstanceOf(Unauthorized);
    await expect(service.master('garbage', VID)).rejects.toBeInstanceOf(Unauthorized);
    await expect(
      service.master(token, '0192f0a0-0000-7000-8000-0000000000ff'),
    ).rejects.toBeInstanceOf(Forbidden);
    advance(31 * 60 + 60);
    await expect(service.master(token, VID)).rejects.toBeInstanceOf(Unauthorized);
  });

  it('rejects odd rendition names and unknown renditions', async () => {
    const { service } = setup();
    const { token } = await service.startSession(viewer, VID);
    await expect(service.variant(token, VID, '../x')).rejects.toBeInstanceOf(NotFound);
    await expect(service.variant(token, VID, '480')).rejects.toBeInstanceOf(NotFound);
  });

  it('returns the unwrapped key and limits by ip and profile', async () => {
    const seen: string[] = [];
    const limiter = {
      enforce: async (p: { name: string }, s: string) => void seen.push(`${p.name}:${s}`),
    };
    const { service } = setup({ limiter });
    const { token } = await service.startSession(viewer, VID);
    const key = await service.key(token, VID, '203.0.113.9');
    expect(Buffer.from(key).equals(Buffer.from(hlsKey))).toBe(true);
    expect(seen).toContain(`${PLAY_POLICIES.keyIp.name}:203.0.113.9`);
    expect(seen).toContain(`${PLAY_POLICIES.keyProfile.name}:${PROFILE}`);
  });

  it('stops serving the key once the video is unpublished', async () => {
    const live = setup();
    const { token } = await live.service.startSession(viewer, VID);
    const dead = setup({ video: { publishState: 'unpublished' } });
    await expect(dead.service.key(token, VID, '1.1.1.1')).rejects.toBeInstanceOf(NotFound);
  });
});

const GUEST = 'Zm9vYmFyYmF6cXV4MTIzNA';
const guestViewer = { guestId: GUEST, kids: false };

describe('PlaybackService guest sessions (M40-S02)', () => {
  it('issues a guest token for a published video with no account', async () => {
    const { service } = setup();
    const s = await service.startGuestSession(guestViewer, VID);
    expect(s.preview).toBe(false);
    expect(s.masterUrl).toBe(`https://app.example/api/play/${VID}/master.m3u8`);
    const claims = await service.authorize(s.token, VID);
    expect(claims).toMatchObject({ aid: GUEST, pid: null, gst: true });
    expect(claims.kd).toBeUndefined();
  });

  it.each([
    ['draft', { publishState: 'draft' }],
    ['deleted', { deletedAt: new Date() }],
    ['processing', { status: 'processing' }],
  ])('treats a %s video as not found for a guest', async (_n, patch) => {
    const { service } = setup({ video: patch });
    await expect(service.startGuestSession(guestViewer, VID)).rejects.toBeInstanceOf(NotFound);
  });

  it('treats an unknown video as not found', async () => {
    const { service } = setup({ video: null });
    await expect(service.startGuestSession(guestViewer, VID)).rejects.toBeInstanceOf(NotFound);
  });

  it('hides a non kids video from a Kids mode guest and issues no token', async () => {
    const { service } = setup({ video: { kidsSafe: false } });
    await expect(
      service.startGuestSession({ guestId: GUEST, kids: true }, VID),
    ).rejects.toBeInstanceOf(NotFound);
    await expect(service.startGuestSession(guestViewer, VID)).resolves.toBeTruthy();
  });

  it('marks Kids mode guest tokens with kd', async () => {
    const { service } = setup({ video: { kidsSafe: true } });
    const s = await service.startGuestSession({ guestId: GUEST, kids: true }, VID);
    expect((await service.authorize(s.token, VID)).kd).toBe(true);
  });

  it('limits sessions per guest id and per ip', async () => {
    const seen: string[] = [];
    const limiter = {
      enforce: async (p: { name: string }, s: string) => void seen.push(`${p.name}:${s}`),
    };
    const { service } = setup({ limiter });
    await service.startGuestSession({ ...guestViewer, ip: '203.0.113.5' }, VID);
    expect(seen).toContain(`${PLAY_POLICIES.sessionGuest.name}:${GUEST}`);
    expect(seen).toContain(`${PLAY_POLICIES.sessionGuestIp.name}:203.0.113.5`);
  });

  it('pins the guest limiter numbers (M40-S11)', () => {
    expect(PLAY_POLICIES.sessionGuest.capacity).toBe(20);
    expect(PLAY_POLICIES.sessionGuest.refillPerSecond).toBeCloseTo(20 / 60);
    expect(PLAY_POLICIES.sessionGuestIp.capacity).toBe(120);
    expect(PLAY_POLICIES.sessionGuestIp.refillPerSecond).toBeCloseTo(120 / 60);
    expect(GUEST_SEGMENT_URL_SECONDS).toBe(20 * 60);
  });

  it('rate limits when the guest limiter refuses', async () => {
    const limiter = {
      enforce: async () => {
        throw new RateLimited(10);
      },
    };
    const { service } = setup({ limiter });
    await expect(service.startGuestSession(guestViewer, VID)).rejects.toBeInstanceOf(RateLimited);
  });

  it('signs guest segment urls for 20 minutes and account ones for 2 hours', async () => {
    const { service, clock } = setup();
    const guest = await service.startGuestSession(guestViewer, VID);
    const acct = await service.startSession(viewer, VID);
    const expOf = async (token: string) => {
      const variant = await service.variant(token, VID, '720');
      const line = variant.split('\n').find((l) => l.includes('seg_00001.ts'))!;
      return Number(new URL(line).searchParams.get('exp'));
    };
    expect(await expOf(guest.token)).toBe(Math.floor(clock()) + 20 * 60);
    expect(await expOf(acct.token)).toBe(Math.floor(clock()) + 2 * 3600);
  });

  it('honours a configured guest segment lifetime', async () => {
    const { service, clock } = setup({ guestTtl: 5 * 60 });
    const guest = await service.startGuestSession(guestViewer, VID);
    const variant = await service.variant(guest.token, VID, '720');
    const line = variant.split('\n').find((l) => l.includes('seg_00001.ts'))!;
    expect(Number(new URL(line).searchParams.get('exp'))).toBe(Math.floor(clock()) + 300);
  });

  it('serves the key to a guest, limited by guest id and ip, with no profile lookup', async () => {
    const seen: string[] = [];
    const limiter = {
      enforce: async (p: { name: string }, s: string) => void seen.push(`${p.name}:${s}`),
    };
    const { service } = setup({ limiter });
    const { token } = await service.startGuestSession(guestViewer, VID);
    const key = await service.key(token, VID, '203.0.113.9');
    expect(Buffer.from(key).equals(Buffer.from(hlsKey))).toBe(true);
    expect(seen).toContain(`${PLAY_POLICIES.keyProfile.name}:${GUEST}`);
    expect(seen).toContain(`${PLAY_POLICIES.keyIp.name}:203.0.113.9`);
  });

  it('refuses the key for a kd token on a video that is not kids safe', async () => {
    const live = setup({ video: { kidsSafe: true } });
    const { token } = await live.service.startGuestSession({ guestId: GUEST, kids: true }, VID);
    const changed = setup({ video: { kidsSafe: false } });
    await expect(changed.service.key(token, VID, '1.1.1.1')).rejects.toBeInstanceOf(NotFound);
  });

  it('rejects a forged guest token', async () => {
    const { service } = setup();
    const { token } = await service.startGuestSession(guestViewer, VID);
    const forged = token.slice(0, -3) + 'abc';
    await expect(service.master(forged, VID)).rejects.toBeInstanceOf(Unauthorized);
    await expect(service.key(forged, VID, '1.1.1.1')).rejects.toBeInstanceOf(Unauthorized);
  });

  it('stops serving a guest once the video is unpublished', async () => {
    const live = setup();
    const { token } = await live.service.startGuestSession(guestViewer, VID);
    const dead = setup({ video: { publishState: 'unpublished' } });
    await expect(dead.service.master(token, VID)).rejects.toBeInstanceOf(NotFound);
  });
});

describe('PlaybackService guest maturity ceiling (M44-S20)', () => {
  it('refuses a guest session above the ceiling and allows one at it', async () => {
    const above = setup({ guestMaxRank: 2, video: { maturityRank: 3 } });
    await expect(above.service.startGuestSession(guestViewer, VID)).rejects.toBeInstanceOf(NotFound);
    const at = setup({ guestMaxRank: 2, video: { maturityRank: 2 } });
    await expect(at.service.startGuestSession(guestViewer, VID)).resolves.toBeTruthy();
  });

  it('treats an unrated, not kids safe title as the highest rank', async () => {
    const { service } = setup({ guestMaxRank: 2, video: { maturityRank: null, kidsSafe: false } });
    await expect(service.startGuestSession(guestViewer, VID)).rejects.toBeInstanceOf(NotFound);
  });

  it('reads the ceiling when it is a function, so a settings change applies at once', async () => {
    let ceiling = 4;
    const { service } = setup({ guestMaxRank: () => ceiling, video: { maturityRank: 4 } });
    await expect(service.startGuestSession(guestViewer, VID)).resolves.toBeTruthy();
    ceiling = 1;
    await expect(service.startGuestSession(guestViewer, VID)).rejects.toBeInstanceOf(NotFound);
  });

  it('has no ceiling when none is configured', async () => {
    const { service } = setup({ video: { maturityRank: 4 } });
    await expect(service.startGuestSession(guestViewer, VID)).resolves.toBeTruthy();
  });

  it('refuses the key when the ceiling was lowered after the session started', async () => {
    const live = setup({ guestMaxRank: 4, video: { maturityRank: 3 } });
    const { token } = await live.service.startGuestSession(guestViewer, VID);
    const lowered = setup({ guestMaxRank: 2, video: { maturityRank: 3 } });
    await expect(lowered.service.key(token, VID, '1.1.1.1')).rejects.toBeInstanceOf(NotFound);
  });

  it('keeps Kids mode guests at rank 0 whatever the ceiling', async () => {
    const { service } = setup({ guestMaxRank: 4, video: { maturityRank: 1, kidsSafe: true } });
    await expect(
      service.startGuestSession({ guestId: GUEST, kids: true }, VID),
    ).rejects.toBeInstanceOf(NotFound);
  });
});
