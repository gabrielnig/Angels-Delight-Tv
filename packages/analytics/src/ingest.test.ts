import { describe, expect, it } from 'vitest';
import { ingestBatch, type CounterBump, type EventStore, type ViewUpsert } from './ingest';
import { deriveAnalyticsSecret } from './identity';
import { createMemoryRateLimiter } from './rate-limit';

const playId = '3f2b8c1e-5d4a-4e7b-9a1c-0d2e4f6a8b10';
const videoId = '0b7f6d52-1c3e-4a58-8f19-2a4c6e8d0b31';
const profileId = '5a1c0d2e-4f6a-4b10-8c1e-3f2b8c1e5d4a';
const secret = deriveAnalyticsSecret(new Uint8Array(32).fill(1));
const UA =
  'Mozilla/5.0 (Linux; Android 13; Tecno) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36';

function fakeStore() {
  const views: ViewUpsert[] = [];
  const bumps: CounterBump[] = [];
  const seen = new Set<string>();
  const store: EventStore = {
    async upsertView(row) {
      views.push(row);
      const created = !seen.has(row.playId);
      seen.add(row.playId);
      return { created };
    },
    async bump(entry) {
      bumps.push(entry);
    },
  };
  return { store, views, bumps };
}

const base = () => ({
  store: fakeStore(),
  limiter: createMemoryRateLimiter(() => 0),
  secret,
  now: () => new Date('2026-03-11T10:00:00Z'),
});
const ctx = (over: Record<string, unknown> = {}) => ({
  userAgent: UA,
  country: 'NG',
  ipKey: '203.0.113.0',
  profileId,
  audience: 'general' as const,
  ...over,
});
const start = { kind: 'view_start', playId, videoId } as const;

describe('ingestBatch', () => {
  it('stores a view with a daily viewer hash, never the raw profile in analytics fields', async () => {
    const deps = base();
    const out = await ingestBatch({
      body: { v: 1, deviceClass: 'phone', saveData: true, events: [start] },
      context: ctx(),
      ...deps,
      store: deps.store.store,
    });
    expect(out.status).toBe(202);
    const row = deps.store.views[0]!;
    expect(row).toMatchObject({
      playId,
      videoId,
      audience: 'general',
      deviceClass: 'phone',
      saveData: true,
      country: 'NG',
    });
    expect(row.viewerHash).toMatch(/^[0-9a-f]{24}$/);
    expect(row.profileId).toBe(profileId);
    expect(row.startedAt.toISOString()).toBe('2026-03-11T10:00:00.000Z');
  });

  it('keeps no profile id and no viewer hash for kids profiles', async () => {
    const deps = base();
    await ingestBatch({
      body: { v: 1, events: [start] },
      context: ctx({ audience: 'kids' }),
      ...deps,
      store: deps.store.store,
    });
    expect(deps.store.views[0]).toMatchObject({
      audience: 'kids',
      profileId: null,
      viewerHash: null,
    });
  });

  it('counts device, connection and country splits only for the first start of a play', async () => {
    const deps = base();
    const body = { v: 1, deviceClass: 'phone', saveData: true, events: [start, start] };
    await ingestBatch({ body, context: ctx(), ...deps, store: deps.store.store });
    const kinds = deps.store.bumps.map((b) => `${b.kind}:${b.key}`);
    expect(kinds.filter((k) => k === 'device:phone')).toHaveLength(1);
    expect(kinds).toContain('connection:save_data');
    expect(kinds).toContain('country:NG');
  });

  it('upserts progress and complete using watched time', async () => {
    const deps = base();
    await ingestBatch({
      body: {
        v: 1,
        events: [
          { kind: 'progress', playId, videoId, watchedMs: 20_000, positionMs: 20_000 },
          { kind: 'complete', playId, videoId, watchedMs: 90_000 },
        ],
      },
      context: ctx(),
      ...deps,
      store: deps.store.store,
    });
    expect(deps.store.views.map((v) => [v.watchedMs, v.completed])).toEqual([
      [20_000, false],
      [90_000, true],
    ]);
  });

  it('drops bots and previews without storing anything', async () => {
    const deps = base();
    const bot = await ingestBatch({
      body: { v: 1, events: [start] },
      context: ctx({ userAgent: 'Googlebot/2.1' }),
      ...deps,
      store: deps.store.store,
    });
    const preview = await ingestBatch({
      body: { v: 1, preview: true, events: [start] },
      context: ctx(),
      ...deps,
      store: deps.store.store,
    });
    expect([bot.status, preview.status]).toEqual([202, 202]);
    expect(deps.store.views).toHaveLength(0);
  });

  it('records only search text for empty results and normalises it', async () => {
    const deps = base();
    await ingestBatch({
      body: {
        v: 1,
        events: [
          { kind: 'search', resultCount: 0, query: '  Maths  Basics ' },
          { kind: 'search', resultCount: 4, query: 'plants' },
          { kind: 'search', resultCount: 0, query: 'me@x.com' },
        ],
      },
      context: ctx(),
      ...deps,
      store: deps.store.store,
    });
    const keys = deps.store.bumps.map((b) => `${b.kind}:${b.key}`);
    expect(keys).toContain('search_empty:maths basics');
    expect(keys.filter((k) => k === 'search:all')).toHaveLength(3);
    expect(keys.filter((k) => k === 'search:empty')).toHaveLength(2);
    expect(keys.some((k) => k.includes('plants') || k.includes('@'))).toBe(false);
  });

  it('counts errors, vitals and startup in buckets', async () => {
    const deps = base();
    await ingestBatch({
      body: {
        v: 1,
        deviceClass: 'phone',
        events: [
          { kind: 'error', code: 'player.network', videoId },
          { kind: 'vitals', name: 'LCP', value: 2300, route: '/' },
          { kind: 'startup', videoId, startupMs: 1800, rebufferMs: 400 },
        ],
      },
      context: ctx(),
      ...deps,
      store: deps.store.store,
    });
    const keys = deps.store.bumps.map((b) => `${b.kind}:${b.key}:${b.by ?? 1}`);
    expect(keys).toContain('error:player.network:1');
    expect(keys).toContain('vitals_LCP:le2500|phone|std:1');
    expect(keys).toContain('startup:le2000|phone|std:1');
    expect(keys).toContain('rebuffer_ms:all:400');
  });

  it('adds the stall time of a rebuffer event to the rebuffer counter without touching startup', async () => {
    const deps = base();
    await ingestBatch({
      body: {
        v: 1,
        deviceClass: 'phone',
        events: [{ kind: 'rebuffer', videoId, rebufferMs: 2500 }],
      },
      context: ctx(),
      ...deps,
      store: deps.store.store,
    });
    const keys = deps.store.bumps.map((b) => `${b.kind}:${b.key}:${b.by ?? 1}`);
    expect(keys).toContain('rebuffer_ms:all:2500');
    expect(keys.some((k) => k.startsWith('startup:'))).toBe(false);
  });

  it('rejects a malformed body with 400 and rate limits with 429 and Retry-After', async () => {
    const deps = base();
    expect(
      (
        await ingestBatch({
          body: { nope: true },
          context: ctx(),
          ...deps,
          store: deps.store.store,
        })
      ).status,
    ).toBe(400);
    let last: { status: number; retryAfterSeconds?: number } = { status: 0 };
    for (let i = 0; i < 70; i += 1) {
      last = await ingestBatch({
        body: { v: 1, events: [] },
        context: ctx(),
        ...deps,
        store: deps.store.store,
      });
    }
    expect(last.status).toBe(429);
    expect(last.retryAfterSeconds).toBeGreaterThan(0);
  });

  it('never throws when the store fails', async () => {
    const deps = base();
    const store: EventStore = {
      async upsertView() {
        throw new Error('db down');
      },
      async bump() {
        throw new Error('db down');
      },
    };
    const out = await ingestBatch({
      body: { v: 1, events: [start, { kind: 'error', code: 'x' }] },
      context: ctx(),
      ...deps,
      store,
    });
    expect(out.status).toBe(202);
  });

  it('ignores a country that is not a real code', async () => {
    const deps = base();
    await ingestBatch({
      body: { v: 1, events: [start] },
      context: ctx({ country: 'T1' }),
      ...deps,
      store: deps.store.store,
    });
    expect(deps.store.views[0]!.country).toBeNull();
  });
});
