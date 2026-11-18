import { SIGNING_TEST_VECTOR, signedMediaUrl } from '@ad/video';
import { describe, expect, it } from 'vitest';
import { handle, sign, type EdgeCache, type EdgeEnv } from './handler';

const SECRET_B64 = Buffer.from(SIGNING_TEST_VECTOR.secret).toString('base64');
const KEY = SIGNING_TEST_VECTOR.key;
const NOW = SIGNING_TEST_VECTOR.exp - 600;
const DATA = new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);

function bucket(
  files: Record<string, Uint8Array> = {
    [KEY]: DATA,
    'cap/a/en.vtt': new TextEncoder().encode('WEBVTT'),
  },
) {
  let gets = 0;
  return {
    gets: () => gets,
    api: {
      head: async (key: string) =>
        files[key] ? { size: files[key]!.length, httpEtag: '"e"' } : null,
      get: async (key: string, o?: { range?: { offset: number; length: number } }) => {
        gets++;
        const all = files[key];
        if (!all) return null;
        const part = o?.range ? all.slice(o.range.offset, o.range.offset + o.range.length) : all;
        return { body: new Blob([part]).stream(), size: all.length };
      },
    },
  };
}

const env = (b = bucket()): EdgeEnv => ({
  MEDIA: b.api,
  MEDIA_URL_SECRET: SECRET_B64,
  APP_ORIGIN: 'https://app.example',
});
const url = (key = KEY, exp = SIGNING_TEST_VECTOR.exp) =>
  signedMediaUrl({ origin: 'https://media.example', key, secret: SIGNING_TEST_VECTOR.secret, exp });
const opts = { now: () => NOW };

class MemoryCache implements EdgeCache {
  store = new Map<string, Response>();
  async match(r: Request) {
    return this.store.get(r.url)?.clone();
  }
  async put(r: Request, response: Response) {
    this.store.set(r.url, response);
  }
}

describe('edge media worker', () => {
  it('computes the same signature as the app (shared test vector)', async () => {
    expect(await sign(SIGNING_TEST_VECTOR.secret, KEY, SIGNING_TEST_VECTOR.exp)).toBe(
      SIGNING_TEST_VECTOR.sig,
    );
  });

  it('serves a signed segment with immutable caching and nosniff', async () => {
    const res = await handle(new Request(url()), env(), opts);
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('public, max-age=31536000, immutable');
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
    expect(res.headers.get('content-type')).toBe('video/mp2t');
    expect(new Uint8Array(await res.arrayBuffer())).toHaveLength(10);
  });

  it('refuses missing, tampered, wrong key and expired signatures', async () => {
    expect((await handle(new Request(`https://m/${KEY}`), env(), opts)).status).toBe(403);
    expect((await handle(new Request(url().replace(/sig=./, 'sig=Z')), env(), opts)).status).toBe(
      403,
    );
    const other = KEY.replace('00001', '00002');
    const swapped = url().replace(KEY, other);
    expect((await handle(new Request(swapped), env(bucket({ [other]: DATA })), opts)).status).toBe(
      403,
    );
    expect(
      (await handle(new Request(url()), env(), { now: () => SIGNING_TEST_VECTOR.exp + 31 })).status,
    ).toBe(403);
    expect(
      (await handle(new Request(url()), env(), { now: () => SIGNING_TEST_VECTOR.exp + 20 })).status,
    ).toBe(200);
  });

  it('accepts the previous secret during rotation', async () => {
    const e = {
      ...env(),
      MEDIA_URL_SECRET: Buffer.from(new Uint8Array(32).fill(1)).toString('base64'),
      MEDIA_URL_SECRET_PREVIOUS: SECRET_B64,
    };
    expect((await handle(new Request(url()), e, opts)).status).toBe(200);
  });

  it('serves captions and images without a signature', async () => {
    const res = await handle(new Request('https://m/cap/a/en.vtt'), env(), opts);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/vtt');
  });

  it('rejects other prefixes and traversal', async () => {
    for (const p of ['originals/a', 'templates/x/master.m3u8', 'v/../originals/a', 'v//x']) {
      expect((await handle(new Request(`https://m/${p}`), env(), opts)).status).toBe(404);
    }
  });

  it('handles byte ranges and bad ranges', async () => {
    const ok = await handle(new Request(url(), { headers: { range: 'bytes=2-4' } }), env(), opts);
    expect(ok.status).toBe(206);
    expect(ok.headers.get('content-range')).toBe('bytes 2-4/10');
    expect([...new Uint8Array(await ok.arrayBuffer())]).toEqual([2, 3, 4]);
    const bad = await handle(
      new Request(url(), { headers: { range: 'bytes=40-50' } }),
      env(),
      opts,
    );
    expect(bad.status).toBe(416);
  });

  it('caches by key without the signature, then still checks the next signature', async () => {
    const cache = new MemoryCache();
    const b = bucket();
    await handle(new Request(url()), env(b), { ...opts, cache });
    const again = await handle(new Request(url(KEY, SIGNING_TEST_VECTOR.exp)), env(b), {
      ...opts,
      cache,
    });
    expect(again.status).toBe(200);
    expect(b.gets()).toBe(1);
    const forged = await handle(new Request(url().replace(/sig=./, 'sig=Z')), env(b), {
      ...opts,
      cache,
    });
    expect(forged.status).toBe(403);
  });

  it('allows CORS only for the app origin', async () => {
    const app = await handle(
      new Request(url(), { headers: { origin: 'https://app.example' } }),
      env(),
      opts,
    );
    expect(app.headers.get('access-control-allow-origin')).toBe('https://app.example');
    const evil = await handle(
      new Request(url(), { headers: { origin: 'https://evil.example' } }),
      env(),
      opts,
    );
    expect(evil.headers.get('access-control-allow-origin')).toBeNull();
    const pre = await handle(
      new Request(url(), { method: 'OPTIONS', headers: { origin: 'https://app.example' } }),
      env(),
      opts,
    );
    expect(pre.status).toBe(204);
  });

  it('rejects writes', async () => {
    expect(
      (await handle(new Request(url(), { method: 'PUT', body: 'x' }), env(), opts)).status,
    ).toBe(405);
  });
});
