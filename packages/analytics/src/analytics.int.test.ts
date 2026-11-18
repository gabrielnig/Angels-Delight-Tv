import { uuidv7 } from '@ad/shared';
import {
  asRole,
  createTestDatabase,
  integrationEnabled,
  makeAccount,
  makeProfile,
  makeVideo,
  type TestDatabase,
} from '@ad/db/testing';
import { accounts, profiles, schema, videos } from '@ad/db';
import { RateLimiter } from '@ad/security';
import { drizzle } from 'drizzle-orm/node-postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { deriveAnalyticsSecret } from './identity';
import { ingestBatch } from './ingest';
import { createAnalyticsQueries } from './queries';
import { pruneViewEvents, rollupDay, runNightlyRollup } from './rollup';
import { createPgEventStore } from './store';

const UA =
  'Mozilla/5.0 (Linux; Android 13; Tecno) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36';
const secret = deriveAnalyticsSecret(new Uint8Array(32).fill(3));

describe.skipIf(!integrationEnabled())('analytics on Postgres', () => {
  let t: TestDatabase;
  const account = makeAccount();
  const profile = makeProfile(account.id);
  const video = makeVideo({ status: 'ready', durationMs: 100_000 });
  const other = makeVideo({ status: 'ready', durationMs: 50_000, title: 'Second lesson' });

  beforeAll(async () => {
    t = await createTestDatabase();
    await t.db.insert(accounts).values(account);
    await t.db.insert(profiles).values(profile);
    await t.db.insert(videos).values([video, other]);
  });
  afterAll(async () => {
    await t?.drop();
  });

  const send = async (
    now: string,
    events: unknown[],
    over: { profileId?: string | null; audience?: 'general' | 'kids' } = {},
  ) =>
    asRole(t.pool, 'ad_app', {}, async (client) => {
      const db = drizzle(client);
      return ingestBatch({
        body: { v: 1, deviceClass: 'phone', saveData: false, events },
        context: {
          userAgent: UA,
          country: 'NG',
          ipKey: '203.0.113.0',
          profileId: over.profileId === undefined ? profile.id : over.profileId,
          audience: over.audience ?? 'general',
        },
        store: createPgEventStore(db),
        limiter: new RateLimiter(drizzle(client, { schema }) as never),
        secret,
        now: () => new Date(now),
      });
    });

  const play = (videoId: string, watchedMs: number, complete = false) => {
    const playId = crypto.randomUUID();
    return [
      { kind: 'view_start', playId, videoId, maxHeight: 360 },
      { kind: 'progress', playId, videoId, watchedMs, positionMs: watchedMs },
      ...(complete ? [{ kind: 'complete', playId, videoId, watchedMs }] : []),
    ];
  };

  it('stores plays idempotently and ignores unknown videos', async () => {
    const events = play(video.id, 30_000);
    await send('2026-03-10T09:00:00Z', events);
    await send('2026-03-10T09:00:20Z', events);
    await send('2026-03-10T09:00:30Z', play(uuidv7(), 5000));
    const rows = (await t.pool.query('select watched_ms, viewer_hash from view_events')).rows;
    expect(rows).toHaveLength(1);
    expect(rows[0].watched_ms).toBe(30_000);
    const device = await t.pool.query("select count from analytics_counters where kind='device'");
    expect(Number(device.rows[0].count)).toBe(1);
  });

  it('does not let a play id be hijacked by another video and never lowers watch time', async () => {
    const playId = crypto.randomUUID();
    await send('2026-03-10T10:00:00Z', [
      { kind: 'view_start', playId, videoId: video.id },
      { kind: 'progress', playId, videoId: video.id, watchedMs: 40_000, positionMs: 40_000 },
    ]);
    await send('2026-03-10T10:01:00Z', [
      { kind: 'progress', playId, videoId: other.id, watchedMs: 99_000, positionMs: 1 },
    ]);
    await send('2026-03-10T10:02:00Z', [
      { kind: 'progress', playId, videoId: video.id, watchedMs: 10_000, positionMs: 1 },
    ]);
    const row = (
      await t.pool.query('select watched_ms, video_id from view_events where play_id = $1', [
        playId,
      ])
    ).rows[0];
    expect(row).toMatchObject({ watched_ms: 40_000, video_id: video.id });
  });

  it('stores nothing identifying for kids profiles', async () => {
    await send('2026-03-10T11:00:00Z', play(video.id, 8000), {
      audience: 'kids',
      profileId: profile.id,
    });
    const row = (
      await t.pool.query("select profile_id, viewer_hash from view_events where audience='kids'")
    ).rows[0];
    expect(row).toEqual({ profile_id: null, viewer_hash: null });
  });

  it('rolls up a Lagos day and replaces results on a rerun', async () => {
    await send('2026-03-10T12:00:00Z', play(video.id, 60_000, true));
    await send('2026-03-10T13:00:00Z', play(other.id, 20_000));
    await rollupDay(t.db, '2026-03-10');
    await rollupDay(t.db, '2026-03-10');
    const stats = (
      await t.pool.query(
        'select video_id, views, watch_ms, completions from video_daily_stats order by views desc',
      )
    ).rows;
    expect(stats[0]).toMatchObject({ video_id: video.id, views: 4, completions: 1 });
    expect(Number(stats[0].watch_ms)).toBe(30_000 + 40_000 + 8000 + 60_000);
    const site = (
      await t.pool.query("select views, uniques from site_daily_stats where day = '2026-03-10'")
    ).rows[0];
    expect(site.views).toBe(5);
    expect(site.uniques).toBe(1);

    await t.pool.query('delete from view_events where video_id = $1', [other.id]);
    await rollupDay(t.db, '2026-03-10');
    const after = (await t.pool.query('select video_id from video_daily_stats')).rows;
    expect(after).toHaveLength(1);
  });

  it('answers the dashboard queries from rollups plus live rows for today', async () => {
    await send('2026-03-11T12:00:00Z', play(video.id, 50_000));
    const queries = createAnalyticsQueries(t.db, {
      now: () => new Date('2026-03-11T15:00:00Z'),
      cacheTtlMs: 0,
    });
    const range = { from: '2026-03-10', to: '2026-03-11' };

    const overview = await queries.overview(range);
    expect(overview.current.views).toBe(5);
    expect(overview.current.watchMs).toBe(30_000 + 40_000 + 8000 + 60_000 + 50_000);
    expect(overview.daily.map((d) => d.day)).toEqual(['2026-03-10', '2026-03-11']);
    expect(overview.previous.views).toBe(0);

    const top = await queries.topTitles(range, {});
    expect(top[0]).toMatchObject({ videoId: video.id, views: 5 });
    expect(top[0]!.avgPercentWatched).toBeGreaterThan(0);

    const detail = await queries.videoDetail(video.id, range);
    expect(detail.daily).toHaveLength(2);
    expect(detail.retention[0]).toMatchObject({ percent: 100 });
    expect(detail.retention.at(-1)!.percent).toBeLessThan(100);
  });

  it('lists views and watch time per title per day, rolled up days plus live today, every title', async () => {
    const queries = createAnalyticsQueries(t.db, {
      now: () => new Date('2026-03-11T15:00:00Z'),
      cacheTtlMs: 0,
    });
    const rows = await queries.titleDaily({ from: '2026-03-10', to: '2026-03-11' });
    expect(rows).toEqual([
      {
        day: '2026-03-10',
        videoId: video.id,
        title: video.title,
        archived: false,
        views: 4,
        watchMs: 30_000 + 40_000 + 8000 + 60_000,
        completions: 1,
      },
      {
        day: '2026-03-11',
        videoId: video.id,
        title: video.title,
        archived: false,
        views: 1,
        watchMs: 50_000,
        completions: 0,
      },
    ]);
    expect(await queries.titleDaily({ from: '2026-01-01', to: '2026-01-02' })).toEqual([]);
  });

  it('keeps archived titles in the per title export and marks them', async () => {
    await t.pool.query('update videos set deleted_at = now() where id = $1', [video.id]);
    const queries = createAnalyticsQueries(t.db, {
      now: () => new Date('2026-03-11T15:00:00Z'),
      cacheTtlMs: 0,
    });
    const rows = await queries.titleDaily({ from: '2026-03-10', to: '2026-03-10' });
    expect(rows.map((r) => r.archived)).toEqual([true]);
    await t.pool.query('update videos set deleted_at = null where id = $1', [video.id]);
  });

  it('reports player quality and empty searches from counters', async () => {
    await send('2026-03-11T12:30:00Z', [
      { kind: 'startup', videoId: video.id, startupMs: 900, rebufferMs: 1000 },
      { kind: 'startup', videoId: video.id, startupMs: 2500 },
      { kind: 'error', code: 'player.network' },
      { kind: 'search', resultCount: 0, query: 'Algebra' },
      { kind: 'vitals', name: 'LCP', value: 1800, route: '/' },
    ]);
    const queries = createAnalyticsQueries(t.db, {
      now: () => new Date('2026-03-11T15:00:00Z'),
      cacheTtlMs: 0,
    });
    const range = { from: '2026-03-11', to: '2026-03-11' };
    const quality = await queries.playerQuality(range);
    expect(quality.startupP50Ms).toBe(1000);
    expect(quality.startupP75Ms).toBe(3000);
    expect(quality.errorsByCode).toEqual([{ code: 'player.network', count: 1 }]);
    expect(quality.vitalsP75.LCP).toBe(2000);
    expect(
      (await queries.playerQuality(range, { deviceClass: 'desktop' })).startupP50Ms,
    ).toBeNull();
    expect(await queries.emptySearches(range)).toEqual([{ query: 'algebra', count: 1 }]);
    const splits = await queries.audienceSplits({ from: '2026-03-10', to: '2026-03-11' });
    expect(splits.device).toEqual([{ label: 'Other', count: expect.any(Number), percent: 100 }]);
  });

  it('prunes raw rows past the retention window but keeps rollups', async () => {
    await pruneViewEvents(t.db, { now: new Date('2030-01-01T00:00:00Z'), retentionDays: 365 });
    expect((await t.pool.query('select count(*)::int as n from view_events')).rows[0].n).toBe(0);
    expect(
      (await t.pool.query('select count(*)::int as n from video_daily_stats')).rows[0].n,
    ).toBeGreaterThan(0);
  });

  it('runs the nightly job for the two previous days', async () => {
    expect(await runNightlyRollup(t.db, new Date('2026-03-12T01:30:00Z'))).toEqual([
      '2026-03-10',
      '2026-03-11',
    ]);
  });
});
