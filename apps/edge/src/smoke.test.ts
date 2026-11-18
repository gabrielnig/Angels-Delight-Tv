import { describe, expect, it } from 'vitest';
import { handle, type EdgeEnv } from './handler';
import { edgeSmoke, type FetchLike } from './smoke';

const APP = 'https://app.example';
const MEDIA = 'https://media.example';

const env: EdgeEnv = {
  MEDIA: { head: async () => null, get: async () => null },
  MEDIA_URL_SECRET: Buffer.from(new Uint8Array(32).fill(3)).toString('base64'),
  APP_ORIGIN: APP,
};

/** The real handler behind a fetch, so the smoke test is checked against the code it will check in production. */
const realEdge: FetchLike = (url, init) => handle(new Request(url, init), env);

describe('edgeSmoke (M22-S01 error case, M31-S03 error case)', () => {
  it('passes against the real edge handler', async () => {
    const results = await edgeSmoke({ mediaOrigin: MEDIA, appOrigin: APP }, realEdge);
    expect(results.filter((r) => !r.ok)).toEqual([]);
    expect(results.map((r) => r.name)).toEqual([
      'cors allows the app origin',
      'cors refuses another origin',
      'cors is not a wildcard',
      'unsigned segment is refused',
      'badly signed segment is refused',
    ]);
  });

  it('fails when the CDN rewrites CORS to a wildcard', async () => {
    const wild: FetchLike = async (url, init) => {
      const res = await realEdge(url, init);
      const headers = new Headers(res.headers);
      headers.set('access-control-allow-origin', '*');
      return new Response(res.body, { status: res.status, headers });
    };
    const failed = (await edgeSmoke({ mediaOrigin: MEDIA, appOrigin: APP }, wild)).filter(
      (r) => !r.ok,
    );
    expect(failed.map((r) => r.name)).toEqual(
      expect.arrayContaining(['cors refuses another origin', 'cors is not a wildcard']),
    );
  });

  it('fails when segments are served without a signature', async () => {
    const open: FetchLike = async (url, init) => {
      if (init?.method === 'OPTIONS') return realEdge(url, init);
      return new Response('segment', { status: 200 });
    };
    const failed = (await edgeSmoke({ mediaOrigin: MEDIA, appOrigin: APP }, open)).filter(
      (r) => !r.ok,
    );
    expect(failed.map((r) => r.name)).toEqual([
      'unsigned segment is refused',
      'badly signed segment is refused',
    ]);
  });

  it('reports an unreachable host as a failure instead of throwing', async () => {
    const down: FetchLike = async () => {
      throw new Error('connect ECONNREFUSED');
    };
    const results = await edgeSmoke({ mediaOrigin: MEDIA, appOrigin: APP }, down);
    expect(results.every((r) => !r.ok)).toBe(true);
    expect(results[0]?.detail).toContain('ECONNREFUSED');
  });
});
