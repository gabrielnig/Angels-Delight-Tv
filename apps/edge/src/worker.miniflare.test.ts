import { signedMediaUrl } from '@ad/video';
import { build } from 'esbuild';
import { Miniflare } from 'miniflare';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

/**
 * The real worker entry (src/index.ts) bundled and run in workerd through miniflare, with an R2 bucket and the
 * Cache API, so the Workers runtime behaviour the Node tests cannot show is covered: R2 reads and ranges,
 * `caches.default` keyed without the signature, CORS and the secret rotation path (M31-S03, M22-S01).
 */

const SECRET = new Uint8Array(32).fill(7);
const PREVIOUS = new Uint8Array(32).fill(9);
const b64 = (u: Uint8Array) => Buffer.from(u).toString('base64');
const APP = 'https://app.example';
const MEDIA = 'http://media.test';
const SEGMENT = 'v/abc123def456/480/seg_00001.ts';
const bytes = new Uint8Array(1000).map((_, i) => i % 251);

const signed = (key = SEGMENT, secret = SECRET, offsetSeconds = 300) =>
  signedMediaUrl({
    origin: MEDIA,
    key,
    secret,
    exp: Math.floor(Date.now() / 1000) + offsetSeconds,
  });

let mf: Miniflare;

interface TestBucket {
  put(key: string, value: string | Uint8Array): Promise<unknown>;
  delete(key: string): Promise<void>;
}
const media = async () => (await mf.getR2Bucket('MEDIA')) as unknown as TestBucket;

beforeAll(async () => {
  const bundled = await build({
    entryPoints: [fileURLToPath(new URL('./index.ts', import.meta.url))],
    bundle: true,
    write: false,
    format: 'esm',
    platform: 'neutral',
    target: 'es2022',
  });
  mf = new Miniflare({
    modules: true,
    script: bundled.outputFiles[0]!.text,
    compatibilityDate: '2025-01-01',
    r2Buckets: ['MEDIA'],
    bindings: {
      MEDIA_URL_SECRET: b64(SECRET),
      MEDIA_URL_SECRET_PREVIOUS: b64(PREVIOUS),
      APP_ORIGIN: APP,
    },
  });
  const bucket = await media();
  await bucket.put(SEGMENT, bytes);
  await bucket.put('cap/abc123def456/en.vtt', 'WEBVTT\n');
  await bucket.put('img/asset1/poster.webp', 'img');
});

afterAll(async () => {
  await mf?.dispose();
});

const get = (url: string, init: RequestInit = {}) => mf.dispatchFetch(url, init as never);

describe('media worker in workerd (miniflare)', () => {
  it('serves a signed segment from R2 with immutable caching and nosniff', async () => {
    const res = await get(signed());
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('public, max-age=31536000, immutable');
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
    expect(res.headers.get('content-type')).toBe('video/mp2t');
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(bytes);
  });

  it('rejects an expired, tampered, unsigned or wrongly keyed url with 403', async () => {
    expect((await get(signed(SEGMENT, SECRET, -120))).status).toBe(403);
    expect((await get(signed().replace(/sig=./, 'sig=A'))).status).toBe(403);
    expect((await get(`${MEDIA}/${SEGMENT}`)).status).toBe(403);
    const other = signed('v/abc123def456/480/seg_00002.ts');
    const swapped = `${MEDIA}/${SEGMENT}${other.slice(other.indexOf('?'))}`;
    expect((await get(swapped)).status).toBe(403);
  });

  it('accepts urls signed with the previous secret during a rotation', async () => {
    expect((await get(signed(SEGMENT, PREVIOUS))).status).toBe(200);
  });

  it('answers byte ranges with 206 and a content-range, and 416 for a bad range', async () => {
    const part = await get(signed(), { headers: { range: 'bytes=10-19' } });
    expect(part.status).toBe(206);
    expect(part.headers.get('content-range')).toBe('bytes 10-19/1000');
    expect(new Uint8Array(await part.arrayBuffer())).toEqual(bytes.slice(10, 20));
    expect((await get(signed(), { headers: { range: 'bytes=5000-6000' } })).status).toBe(416);
  });

  it('serves captions and images with no signature, but never other prefixes', async () => {
    expect((await get(`${MEDIA}/cap/abc123def456/en.vtt`)).status).toBe(200);
    expect((await get(`${MEDIA}/img/asset1/poster.webp`)).status).toBe(200);
    expect((await get(`${MEDIA}/originals/secret.mp4`)).status).toBe(404);
    expect((await get(`${MEDIA}/v/../originals/x`)).status).toBe(404);
  });

  it('allows CORS for the app origin only and answers the preflight', async () => {
    const ok = await get(signed(), { headers: { origin: APP } });
    expect(ok.headers.get('access-control-allow-origin')).toBe(APP);
    const bad = await get(signed(), { headers: { origin: 'https://evil.example' } });
    expect(bad.headers.get('access-control-allow-origin')).toBeNull();
    const pre = await get(`${MEDIA}/${SEGMENT}`, {
      method: 'OPTIONS',
      headers: { origin: APP, 'access-control-request-method': 'GET' },
    });
    expect(pre.status).toBe(204);
    expect(pre.headers.get('access-control-allow-methods')).toContain('GET');
  });

  it('rejects writes', async () => {
    expect((await get(signed(), { method: 'PUT', body: 'x' })).status).toBe(405);
  });

  it('caches by key without the signature, then still checks the next signature', async () => {
    const bucket = await media();
    const key = 'v/cachedprefix1/360/seg_00000.ts';
    await bucket.put(key, bytes);
    expect((await get(signed(key))).status).toBe(200);
    // The Cache API write is deferred with waitUntil, so give workerd a moment to finish it.
    await new Promise((r) => setTimeout(r, 300));
    await bucket.delete(key);
    const again = await get(signed(key, SECRET, 301));
    expect(again.status).toBe(200);
    expect(new Uint8Array(await again.arrayBuffer())).toEqual(bytes);
    expect((await get(signed(key, SECRET, -120))).status).toBe(403);
  });
});
