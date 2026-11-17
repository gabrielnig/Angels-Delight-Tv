import { Forbidden, NotFound, RateLimited, Unauthorized } from '@ad/shared';
import { Readable } from 'node:stream';
import { describe, expect, it } from 'vitest';
import { generateHlsKey, keyring, wrapHlsKey } from '../hls-key';
import { secretRing } from '../playback-token';
import { buildMasterTemplate, buildVariantTemplate } from '../playlist';
import { verifyMediaSignature } from '../signing';
import { PLAY_POLICIES, PlaybackService, type PlayableVideo, type PlaybackStore } from './service';

const VID = '0192f0a0-0000-7000-8000-0000000000aa';
const PROFILE = '0192f0a0-0000-7000-8000-0000000000b1';
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

function setup(over: { video?: Partial<PlayableVideo> | null; kids?: boolean; limiter?: unknown } = {}) {
  let clock = 1_800_000_000;
  const video = over.video === null ? null : { ...baseVideo, ...over.video };
  const store: PlaybackStore = {
    video: async () => video,
    profile: async (id, account) =>
      id === PROFILE && account === ACCOUNT ? { id, isKids: over.kids ?? false } : null,
    wrappedKey: async () => wrapHlsKey(keyring(kek), VID, hlsKey).keyWrapped,
    captions: async () => [{ language: 'en', label: 'English', isDefault: true, key: `cap/abc/en.vtt` }],
  };
  const files: Record<string, string> = {
    [`templates/${VID}/master.m3u8`]: buildMasterTemplate([
      { height: 720, width: 1280, bandwidthBps: 2_000_000, avgBandwidthBps: 1_500_000, codecs: 'avc1.4d401f,mp4a.40.2' },
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
    now: () => clock,
  });
  return { service, advance: (s: number) => (clock += s), clock: () => clock };
}

const viewer = { accountId: ACCOUNT, profileId: PROFILE };

describe('PlaybackService sessions', () => {
  it('issues a token, master url and public caption urls for a published video', async () => {
    const { service } = setup();
    const s = await service.startSession(viewer, VID);
    expect(s.masterUrl).toBe(`https://app.example/api/play/${VID}/master.m3u8`);
    expect(s.captions[0]?.url).toBe('https://media.example/cap/abc/en.vtt');
    expect(s.preview).toBe(false);
  });

  it.each([
    ['draft', { publishState: 'draft' }],
    ['deleted', { deletedAt: new Date() }],
    ['processing', { status: 'processing' }],
    ['scheduled in the future', { publishState: 'scheduled', publishAt: new Date(1_900_000_000_000) }],
  ])('treats a %s video as not found', async (_n, patch) => {
    const { service } = setup({ video: patch });
    await expect(service.startSession(viewer, VID)).rejects.toBeInstanceOf(NotFound);
  });

  it('allows a scheduled video once its time has passed', async () => {
    const { service } = setup({ video: { publishState: 'scheduled', publishAt: new Date(1_700_000_000_000) } });
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
    await expect(service.startPreview({ accountId: ACCOUNT, role: 'viewer' }, VID)).rejects.toBeInstanceOf(Forbidden);
    await expect(service.master(s.token, VID)).resolves.toContain('#EXTM3U');
  });
});

describe('PlaybackService playlists and key', () => {
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
      verifyMediaSignature(mediaSecret, url.pathname.slice(1), Number(url.searchParams.get('exp')), url.searchParams.get('sig')!, clock()),
    ).toBe(true);
  });

  it('carries the token in the query for native HLS clients', async () => {
    const { service } = setup();
    const { token } = await service.startSession(viewer, VID);
    expect(await service.master(token, VID, true)).toContain(`720.m3u8?pt=${encodeURIComponent(token)}`);
    expect(await service.variant(token, VID, '720', true)).toContain(`keys/${VID}?pt=`);
  });

  it('rejects missing, expired and wrong video tokens', async () => {
    const { service, advance } = setup();
    const { token } = await service.startSession(viewer, VID);
    await expect(service.master(null, VID)).rejects.toBeInstanceOf(Unauthorized);
    await expect(service.master('garbage', VID)).rejects.toBeInstanceOf(Unauthorized);
    await expect(service.master(token, '0192f0a0-0000-7000-8000-0000000000ff')).rejects.toBeInstanceOf(Forbidden);
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
    const limiter = { enforce: async (p: { name: string }, s: string) => void seen.push(`${p.name}:${s}`) };
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
