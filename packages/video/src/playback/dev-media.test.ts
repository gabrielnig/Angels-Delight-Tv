import { LocalStorage } from '@ad/storage';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { signedMediaUrl } from '../signing';
import { createDevMediaHandler } from './dev-media';

const secret = new Uint8Array(32).fill(4);
const KEY = 'v/abcdefghijklmnopqrstuvwx/720/seg_00001.ts';
const NOW = 1_800_000_000;

describe('dev media handler', () => {
  let root: string;
  let handler: ReturnType<typeof createDevMediaHandler>;
  const url = (key = KEY, exp = NOW + 600) =>
    signedMediaUrl({ origin: 'http://localhost:3000/api/dev-media', key, secret, exp });

  beforeAll(async () => {
    root = await mkdtemp(join(tmpdir(), 'devmedia-'));
    const media = new LocalStorage({ root, bucket: 'media', secret } as never);
    await media.put(KEY, new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]));
    await media.put('cap/abc/en.vtt', new TextEncoder().encode('WEBVTT\n'));
    handler = createDevMediaHandler({
      nodeEnv: 'development',
      mediaSecret: secret,
      media,
      now: () => NOW,
    });
  });
  afterAll(() => rm(root, { recursive: true, force: true }));

  it('serves a correctly signed segment', async () => {
    const res = await handler(new Request(url()), KEY);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('video/mp2t');
    expect(new Uint8Array(await res.arrayBuffer())).toHaveLength(10);
  });

  it('refuses missing, wrong and expired signatures', async () => {
    expect((await handler(new Request(`http://x/${KEY}`), KEY)).status).toBe(403);
    expect((await handler(new Request(url().replace(/sig=./, 'sig=Z')), KEY)).status).toBe(403);
    expect((await handler(new Request(url(KEY, NOW - 100)), KEY)).status).toBe(403);
    const other = 'v/abcdefghijklmnopqrstuvwx/720/seg_00002.ts';
    expect((await handler(new Request(url()), other)).status).toBe(403);
  });

  it('serves byte ranges', async () => {
    const res = await handler(new Request(url(), { headers: { range: 'bytes=2-4' } }), KEY);
    expect(res.status).toBe(206);
    expect(res.headers.get('content-range')).toBe('bytes 2-4/10');
    expect([...new Uint8Array(await res.arrayBuffer())]).toEqual([2, 3, 4]);
    const bad = await handler(new Request(url(), { headers: { range: 'bytes=50-60' } }), KEY);
    expect(bad.status).toBe(416);
  });

  it('serves captions without a signature and rejects traversal', async () => {
    expect((await handler(new Request('http://x/cap/abc/en.vtt'), 'cap/abc/en.vtt')).status).toBe(
      200,
    );
    expect((await handler(new Request('http://x/v/../secret'), 'v/../secret')).status).toBe(404);
    expect((await handler(new Request('http://x/originals/a'), 'originals/a')).status).toBe(404);
  });

  it('does not exist in production', async () => {
    const prod = createDevMediaHandler({
      nodeEnv: 'production',
      mediaSecret: secret,
      media: {} as never,
    });
    expect((await prod(new Request(url()), KEY)).status).toBe(404);
  });
});
