import {
  createMemoryRateLimiter,
  deriveAnalyticsSecret,
  type CounterBump,
  type EventStore,
  type ViewUpsert,
} from '@ad/analytics';
import { describe, expect, it } from 'vitest';
import { createAnalyticsHandler, type AnalyticsHandlerDeps } from './handler';

const videoId = '0b7f6d52-1c3e-4a58-8f19-2a4c6e8d0b31';
const playId = '3f2b8c1e-5d4a-4e7b-9a1c-0d2e4f6a8b10';
const UA =
  'Mozilla/5.0 (Linux; Android 13; Tecno) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36';

function setup(over: Partial<AnalyticsHandlerDeps> = {}) {
  const views: ViewUpsert[] = [];
  const bumps: CounterBump[] = [];
  const store: EventStore = {
    async upsertView(row) {
      views.push(row);
      return { created: true };
    },
    async bump(b) {
      bumps.push(b);
    },
  };
  const handler = createAnalyticsHandler({
    store,
    limiter: createMemoryRateLimiter(),
    secret: deriveAnalyticsSecret(new Uint8Array(32).fill(2)),
    trustedProxyMode: 'cloudflare',
    resolveViewer: async () => ({ profileId: 'p-1', audience: 'general' }),
    ...over,
  });
  const post = (body: unknown, headers: Record<string, string> = {}) =>
    handler(
      new Request('https://tv.example/api/analytics', {
        method: 'POST',
        body: typeof body === 'string' ? body : JSON.stringify(body),
        headers: {
          'user-agent': UA,
          'cf-connecting-ip': '203.0.113.9',
          'cf-ipcountry': 'NG',
          ...headers,
        },
      }),
    );
  return { post, views, bumps };
}
const start = { kind: 'view_start', playId, videoId };

describe('analytics route handler', () => {
  it('accepts a batch with 202, no body and no caching', async () => {
    const { post, views } = setup();
    const res = await post({ v: 1, events: [start] });
    expect(res.status).toBe(202);
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(await res.text()).toBe('');
    expect(views[0]).toMatchObject({ profileId: 'p-1', country: 'NG' });
  });

  it('takes the profile and audience from the session, not the body', async () => {
    const { post, views } = setup({
      resolveViewer: async () => ({ profileId: 'kid', audience: 'kids' }),
    });
    await post({ v: 1, profileId: 'someone-else', audience: 'general', events: [start] });
    expect(views[0]).toMatchObject({ profileId: null, audience: 'kids' });
  });

  it('records an anonymous play for a signed out visitor', async () => {
    const { post, views } = setup({
      resolveViewer: async () => ({ profileId: null, audience: 'general' }),
    });
    await post({ v: 1, events: [start] });
    expect(views[0]).toMatchObject({ profileId: null, viewerHash: null });
  });

  it('rejects bad json and bad shape with 400', async () => {
    const { post } = setup();
    expect((await post('{nope')).status).toBe(400);
    expect((await post({ v: 9, events: [] })).status).toBe(400);
  });

  it('rejects oversized bodies with 413 before parsing', async () => {
    const { post } = setup();
    expect((await post('x'.repeat(20_000))).status).toBe(413);
  });

  it('rate limits per truncated ip with Retry-After', async () => {
    const { post } = setup();
    let last: Response | undefined;
    for (let i = 0; i < 130; i += 1) last = await post({ v: 1, events: [] });
    expect(last!.status).toBe(429);
    expect(Number(last!.headers.get('retry-after'))).toBeGreaterThan(0);
  });

  it('still answers 202 when the session lookup fails, treating the visitor as anonymous', async () => {
    const { post, views } = setup({
      resolveViewer: async () => {
        throw new Error('auth down');
      },
    });
    expect((await post({ v: 1, events: [start] })).status).toBe(202);
    expect(views[0]!.profileId).toBeNull();
  });
});
