import { createDb, schema } from '@ad/db';
import {
  createTestDatabase,
  integrationEnabled,
  makeAccount,
  makeProfile,
  makeVideo,
  type TestDatabase,
} from '@ad/db/testing';
import { uuidv7 } from '@ad/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { fanoutNotices, pruneNotices } from './notices';

const NOW = new Date('2026-11-24T10:00:00Z');
const OLD = new Date('2026-01-01T00:00:00Z');

describe.skipIf(!integrationEnabled())('viewer notices fanout (M44-S12, S13)', () => {
  let t: TestDatabase;
  let workerPool: TestDatabase['pool'];
  let worker: ReturnType<typeof createDb>;
  const ids: Record<string, string> = {};

  async function person(name: string, profile: Partial<typeof schema.profiles.$inferInsert> = {}) {
    const account = makeAccount();
    await t.db.insert(schema.accounts).values(account);
    const p = makeProfile(account.id, { isPrimary: !profile.isKids, ...profile });
    await t.db.insert(schema.profiles).values(p);
    ids[name] = p.id;
    return { accountId: account.id, profileId: p.id };
  }

  async function makeSeries(slug: string, state: 'published' | 'draft' = 'published') {
    const seriesId = uuidv7();
    const seasonId = uuidv7();
    await t.db.insert(schema.series).values({ id: seriesId, slug, title: `Series ${slug}`, publishState: state, maturityRank: 1 });
    await t.db.insert(schema.seasons).values({ id: seasonId, seriesId, number: 1 });
    return { seriesId, seasonId };
  }

  let episodeNumber = 0;
  async function addEpisode(
    seasonId: string,
    over: Partial<typeof schema.videos.$inferInsert> = {},
  ) {
    const video = makeVideo({
      kind: 'episode',
      status: 'ready',
      durationMs: 60000,
      publishState: 'published',
      maturityRank: 1,
      ...over,
    });
    await t.db.insert(schema.videos).values(video);
    episodeNumber += 1;
    await t.db.insert(schema.episodes).values({ seasonId, videoId: video.id, number: episodeNumber });
    return video.id;
  }

  const notices = async (profileId?: string) =>
    (
      await t.pool.query(
        `SELECT profile_id, kind, title, body, href, item_count, dedupe_key FROM viewer_notices
         ${profileId ? 'WHERE profile_id = $1' : ''} ORDER BY created_at, dedupe_key`,
        profileId ? [profileId] : [],
      )
    ).rows;

  beforeAll(async () => {
    t = await createTestDatabase();
    const PoolClass = t.pool.constructor as new (config: object) => TestDatabase['pool'];
    workerPool = new PoolClass({ connectionString: t.url, max: 2, options: '-c role=ad_worker' });
    worker = createDb(workerPool);
  });
  afterAll(async () => {
    await workerPool?.end();
    await t?.drop();
  });

  it('writes one collapsed notice per series for profiles that follow it, and skips everyone else', async () => {
    const lister = await person('lister');
    const watcher = await person('watcher');
    const stale = await person('stale');
    const limited = await person('limited', { maxMaturityRank: 0 });
    await person('stranger');
    await person('kid', { isKids: true, maxMaturityRank: 0 });
    const s = await makeSeries('alpha');
    const first = await addEpisode(s.seasonId, { announcedAt: OLD });
    await t.pool.query('INSERT INTO my_list (profile_id, series_id) VALUES ($1, $2)', [lister.profileId, s.seriesId]);
    await t.pool.query('INSERT INTO my_list (profile_id, series_id) VALUES ($1, $2)', [limited.profileId, s.seriesId]);
    for (const [who, when] of [
      [watcher.profileId, new Date('2026-11-01T00:00:00Z')],
      [stale.profileId, new Date('2026-06-01T00:00:00Z')],
    ] as const)
      await t.pool.query(
        'INSERT INTO watch_progress (profile_id, video_id, position_ms, duration_ms, updated_at) VALUES ($1, $2, 1000, 60000, $3)',
        [who, first, when],
      );
    await addEpisode(s.seasonId);
    await addEpisode(s.seasonId);
    await addEpisode(s.seasonId);
    const result = await fanoutNotices(worker, NOW);
    expect(result.claimed).toBe(3);
    const rows = await notices();
    expect(rows.map((r) => r.profile_id).sort()).toEqual([ids.lister, ids.watcher].sort());
    const mine = rows.find((r) => r.profile_id === ids.lister);
    expect(mine).toMatchObject({
      kind: 'new_episode',
      title: '3 new episodes of Series alpha',
      href: '/series/alpha',
      item_count: 3,
      dedupe_key: `episode:${s.seriesId}:${ids.lister}:2026-11-24`,
    });
  });

  it('running the fanout again creates nothing new', async () => {
    const before = await notices();
    const result = await fanoutNotices(worker, NOW);
    expect(result).toMatchObject({ claimed: 0, notices: 0 });
    expect(await notices()).toEqual(before);
  });

  it('a later episode on the same day grows the existing notice instead of adding another', async () => {
    const row = (await t.pool.query('SELECT series_id FROM viewer_notices LIMIT 1')).rows[0];
    const season = (await t.pool.query('SELECT id FROM seasons WHERE series_id = $1', [row.series_id])).rows[0];
    await addEpisode(season.id);
    await fanoutNotices(worker, NOW);
    const mine = await notices(ids.lister);
    expect(mine).toHaveLength(1);
    expect(mine[0]).toMatchObject({ title: '4 new episodes of Series alpha', item_count: 4 });
    expect((await t.pool.query('SELECT read_at FROM viewer_notices WHERE profile_id = $1', [ids.lister])).rows[0].read_at).toBeNull();
  });

  it('a single new episode reads "New episode of" and a profile limit hides a higher rated episode', async () => {
    const s = await makeSeries('beta');
    await t.pool.query('INSERT INTO my_list (profile_id, series_id) VALUES ($1, $2), ($3, $2)', [ids.lister, s.seriesId, ids.limited]);
    await addEpisode(s.seasonId, { maturityRank: 3 });
    await fanoutNotices(worker, NOW);
    const mine = (await notices(ids.lister)).find((r) => r.href === '/series/beta');
    expect(mine).toMatchObject({ title: 'New episode of Series beta', item_count: 1 });
    expect((await notices(ids.limited)).find((r) => r.href === '/series/beta')).toBeUndefined();
  });

  it('an episode of a series that is not published stays unclaimed until the series is live', async () => {
    const s = await makeSeries('gamma', 'draft');
    const id = await addEpisode(s.seasonId);
    await t.pool.query('INSERT INTO my_list (profile_id, series_id) VALUES ($1, $2)', [ids.lister, s.seriesId]);
    expect((await fanoutNotices(worker, NOW)).claimed).toBe(0);
    await t.pool.query("UPDATE series SET publish_state = 'published' WHERE id = $1", [s.seriesId]);
    expect((await fanoutNotices(worker, NOW)).claimed).toBe(1);
    expect((await t.pool.query('SELECT announced_at FROM videos WHERE id = $1', [id])).rows[0].announced_at).not.toBeNull();
  });

  it('new standalone videos make one grouped notice per profile per day with the first three titles', async () => {
    await t.pool.query('UPDATE viewer_notices SET read_at = now()');
    const quiet = await person('quiet');
    await t.pool.query('INSERT INTO viewer_notification_prefs (account_id, new_videos) VALUES ($1, false)', [quiet.accountId]);
    const titles = ['One', 'Two', 'Three', 'Four', 'Five'];
    for (const title of titles)
      await t.db.insert(schema.videos).values(
        makeVideo({ title, status: 'ready', durationMs: 60000, publishState: 'published', maturityRank: 0 }),
      );
    await fanoutNotices(worker, NOW);
    const mine = (await notices(ids.stranger)).filter((r) => r.kind === 'new_video');
    expect(mine).toHaveLength(1);
    expect(mine[0]).toMatchObject({ title: '5 new videos', item_count: 5, href: '/browse' });
    expect(mine[0].body.split(', ')).toHaveLength(3);
    expect(await notices(ids.kid)).toEqual([]);
    expect(await notices(quiet.profileId)).toEqual([]);
    expect(await notices(ids.limited)).toHaveLength(1);
  });

  it('a video above the profile limit is not counted for that profile', async () => {
    await t.db.insert(schema.videos).values(
      makeVideo({ title: 'Mature', status: 'ready', durationMs: 60000, publishState: 'published', maturityRank: 4 }),
    );
    await fanoutNotices(worker, new Date('2026-11-25T08:00:00Z'));
    const limited = (await notices(ids.limited)).filter((r) => r.dedupe_key.startsWith('video:') && r.dedupe_key.endsWith('2026-11-25'));
    expect(limited).toEqual([]);
    const open = (await notices(ids.stranger)).filter((r) => r.dedupe_key.endsWith('2026-11-25'));
    expect(open[0]).toMatchObject({ title: 'New video: Mature', item_count: 1 });
  });

  it('videos that were live before launch never notify', async () => {
    const before = await notices();
    await t.db.insert(schema.videos).values(
      makeVideo({ status: 'ready', durationMs: 60000, publishState: 'published', maturityRank: 0, announcedAt: OLD }),
    );
    await fanoutNotices(worker, NOW);
    expect(await notices()).toEqual(before);
  });

  it('a failure after the claim rolls the claim back, so a retry sends exactly one notice', async () => {
    const reader = await person('reader');
    const s = await makeSeries('delta');
    await t.pool.query('INSERT INTO my_list (profile_id, series_id) VALUES ($1, $2)', [reader.profileId, s.seriesId]);
    const id = await addEpisode(s.seasonId);
    await expect(
      fanoutNotices(worker, NOW, {
        beforeCommit() {
          throw new Error('crash');
        },
      }),
    ).rejects.toThrow('crash');
    expect((await t.pool.query('SELECT announced_at FROM videos WHERE id = $1', [id])).rows[0].announced_at).toBeNull();
    await fanoutNotices(worker, NOW);
    await fanoutNotices(worker, NOW);
    expect((await notices(reader.profileId)).filter((r) => r.href === '/series/delta')).toHaveLength(1);
  });

  it('prune removes notices older than 60 days and keeps the newest 100 per profile', async () => {
    const owner = await person('pruned');
    const rows: string[] = [];
    for (let i = 0; i < 105; i += 1)
      rows.push(`('${owner.profileId}', 'new_video', 'N${i}', '/browse', 'k${i}', now() - make_interval(mins => ${i}))`);
    rows.push(`('${owner.profileId}', 'new_video', 'ancient', '/browse', 'old', now() - interval '61 days')`);
    await t.pool.query(
      `INSERT INTO viewer_notices (profile_id, kind, title, href, dedupe_key, created_at) VALUES ${rows.join(',')}`,
    );
    const result = await pruneNotices(worker, new Date());
    expect(result.deleted).toBe(6);
    const left = await notices(owner.profileId);
    expect(left).toHaveLength(100);
    expect(left.map((r) => r.title)).not.toContain('N104');
    expect((await pruneNotices(worker, new Date())).deleted).toBe(0);
  });
});
