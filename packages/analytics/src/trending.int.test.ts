import { uuidv7 } from '@ad/shared';
import { createTestDatabase, integrationEnabled, makeVideo, type TestDatabase } from '@ad/db/testing';
import { schema } from '@ad/db';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { DEFAULT_TRENDING_CONFIG, refreshTrending } from './trending';

const NOW = new Date('2026-06-10T10:00:00Z'); // 11:00 in Lagos, same day

describe.skipIf(!integrationEnabled())('refreshTrending (M44-S07, M44-S08)', () => {
  let t: TestDatabase;
  const config = { ...DEFAULT_TRENDING_CONFIG, minPlays: 3 };

  beforeAll(async () => {
    t = await createTestDatabase();
  });
  afterAll(async () => {
    await t?.drop();
  });
  const wipe = async () => {
    await t.pool.query('DELETE FROM title_scores');
    await t.pool.query('DELETE FROM view_events');
  };

  async function video(over = {}) {
    const v = makeVideo({ status: 'ready', durationMs: 60_000, ...over });
    await t.db.insert(schema.videos).values(v);
    return v.id;
  }
  async function play(
    videoId: string,
    daysAgo: number,
    opts: { who?: string | null; kids?: boolean; completed?: boolean } = {},
  ) {
    const at = new Date(NOW.getTime() - daysAgo * 86_400_000);
    const kids = opts.kids ?? false;
    await t.db.insert(schema.viewEvents).values({
      playId: uuidv7(),
      videoId,
      audience: kids ? 'kids' : 'general',
      startedAt: at,
      watchedMs: 30_000,
      completed: opts.completed ?? false,
      viewerHash: kids ? null : (opts.who === undefined ? uuidv7() : opts.who),
    });
  }
  const scores = async (kind = 'trending') =>
    (
      await t.pool.query(
        'SELECT video_id, series_id, score, plays, rank FROM title_scores WHERE kind = $1 ORDER BY rank',
        [kind],
      )
    ).rows;

  it('weights newer days higher and ranks by score', async () => {
    await wipe();
    const fresh = await video();
    const old = await video();
    for (let i = 0; i < 4; i++) await play(fresh, 0);
    for (let i = 0; i < 4; i++) await play(old, 5);
    await refreshTrending(t.db, NOW, config);
    const rows = await scores();
    expect(rows.map((r) => r.video_id)).toEqual([fresh, old]);
    expect(rows[0].score).toBeCloseTo(4, 5);
    expect(rows[1].score).toBeCloseTo(4 * Math.pow(0.8, 5), 5);
    expect(rows.map((r) => r.rank)).toEqual([1, 2]);
  });

  it('caps one viewer at 3 plays a day', async () => {
    await wipe();
    const v = await video();
    for (let i = 0; i < 9; i++) await play(v, 0, { who: 'same-viewer' });
    await refreshTrending(t.db, NOW, { ...config, minPlays: 1 });
    expect((await scores())[0].plays).toBe(3);
  });

  it('kids plays count one each, and completions add weight', async () => {
    await wipe();
    const v = await video();
    for (let i = 0; i < 5; i++) await play(v, 0, { kids: true });
    await refreshTrending(t.db, NOW, config);
    expect((await scores())[0].plays).toBe(5);
    const w = await video();
    for (let i = 0; i < 3; i++) await play(w, 0, { completed: true });
    await refreshTrending(t.db, NOW, config);
    const row = (await scores()).find((r) => r.video_id === w);
    expect(row.score).toBeCloseTo(6, 5);
    expect(row.plays).toBe(3);
  });

  it('series score is the sum of its episodes', async () => {
    await wipe();
    const seriesId = uuidv7();
    await t.db.insert(schema.series).values({ id: seriesId, slug: 'trend-series', title: 'T' });
    const seasonId = uuidv7();
    await t.db.insert(schema.seasons).values({ id: seasonId, seriesId, number: 1 });
    for (const n of [1, 2]) {
      const ep = await video({ kind: 'episode' });
      await t.db.insert(schema.episodes).values({ seasonId, videoId: ep, number: n });
      for (let i = 0; i < 2; i++) await play(ep, 0);
    }
    await refreshTrending(t.db, NOW, config);
    const rows = await scores();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ series_id: seriesId, video_id: null, plays: 4 });
  });

  it('excludes titles under the minimum plays, writes nothing for an empty site and ignores plays outside the window', async () => {
    await wipe();
    const low = await video();
    await play(low, 0);
    await play(low, 0);
    const outside = await video();
    for (let i = 0; i < 5; i++) await play(outside, 8);
    await refreshTrending(t.db, NOW, config);
    expect(await scores()).toEqual([]);
    await wipe();
    await refreshTrending(t.db, NOW, config);
    expect(await scores()).toEqual([]);
  });

  it('rerunning replaces the rows and gives the same result', async () => {
    await wipe();
    const v = await video();
    for (let i = 0; i < 4; i++) await play(v, 1);
    await refreshTrending(t.db, NOW, config);
    const first = await scores();
    await refreshTrending(t.db, NOW, config);
    expect(await scores()).toEqual(first);
  });

  it('popular counts 30 day views and keeps the top rows', async () => {
    await wipe();
    const v = await video();
    for (let i = 0; i < 6; i++) await play(v, 20);
    await refreshTrending(t.db, NOW, config);
    const rows = await scores('popular');
    expect(rows[0]).toMatchObject({ video_id: v, plays: 6 });
  });
});
