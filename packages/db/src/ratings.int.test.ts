import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { accounts, profiles, series, videos } from './schema';
import {
  asRole,
  createTestDatabase,
  integrationEnabled,
  makeAccount,
  makeProfile,
  makeVideo,
  type TestDatabase,
} from './testing';

describe.skipIf(!integrationEnabled())('title ratings (migration title_ratings)', () => {
  let t: TestDatabase;
  let accountA: ReturnType<typeof makeAccount>;
  let accountB: ReturnType<typeof makeAccount>;
  let adultA: ReturnType<typeof makeProfile>;
  let kidsA: ReturnType<typeof makeProfile>;
  let adultB: ReturnType<typeof makeProfile>;
  let video: ReturnType<typeof makeVideo>;
  let seriesId: string;

  beforeAll(async () => {
    t = await createTestDatabase();
    accountA = makeAccount();
    accountB = makeAccount();
    await t.db.insert(accounts).values([accountA, accountB]);
    adultA = makeProfile(accountA.id, { isPrimary: true });
    kidsA = makeProfile(accountA.id, { isKids: true, position: 1 });
    adultB = makeProfile(accountB.id, { isPrimary: true });
    await t.db.insert(profiles).values([adultA, kidsA, adultB]);
    video = makeVideo();
    await t.db.insert(videos).values(video);
    seriesId = video.id.replace(/.$/, '9');
    await t.db.insert(series).values({ id: seriesId, slug: 'rated-series', title: 'Rated' });
  });
  afterAll(async () => {
    await t?.drop();
  });

  const rate = (accountId: string, profileId: string, value: number, target = 'video_id', id = video.id) =>
    asRole(t.pool, 'ad_app', { accountId }, (c) =>
      c.query(
        `INSERT INTO title_ratings (profile_id, ${target}, value) VALUES ($1, $2, $3)
         ON CONFLICT DO NOTHING`,
        [profileId, id, value],
      ),
    );

  it('stores only -1, 1 and 2 and exactly one target', async () => {
    await expect(rate(accountA.id, adultA.id, 0)).rejects.toThrow();
    await expect(rate(accountA.id, adultA.id, 3)).rejects.toThrow();
    await expect(
      asRole(t.pool, 'ad_app', { accountId: accountA.id }, (c) =>
        c.query('INSERT INTO title_ratings (profile_id, value) VALUES ($1, 1)', [adultA.id]),
      ),
    ).rejects.toThrow();
    await rate(accountA.id, adultA.id, 2);
    await rate(accountA.id, adultA.id, 1, 'series_id', seriesId);
  });

  it('keeps one rating per profile and title', async () => {
    const count = async () =>
      (await t.pool.query('SELECT count(*)::int AS n FROM title_ratings WHERE profile_id = $1 AND video_id = $2', [adultA.id, video.id])).rows[0].n;
    await t.pool.query('UPDATE title_ratings SET value = -1 WHERE profile_id = $1 AND video_id = $2', [adultA.id, video.id]);
    expect(await count()).toBe(1);
    await expect(
      t.pool.query('INSERT INTO title_ratings (profile_id, video_id, value) VALUES ($1, $2, 1)', [adultA.id, video.id]),
    ).rejects.toThrow();
  });

  it('a kids profile cannot rate and the trigger blocks a direct insert', async () => {
    await expect(rate(accountA.id, kidsA.id, 1)).rejects.toThrow(/kids/i);
    await expect(
      t.pool.query('INSERT INTO title_ratings (profile_id, video_id, value) VALUES ($1, $2, 1)', [kidsA.id, video.id]),
    ).rejects.toThrow(/kids/i);
  });

  it('account A cannot read or write account B ratings (RLS), and no context sees zero rows', async () => {
    await rate(accountB.id, adultB.id, 2);
    const visible = await asRole(t.pool, 'ad_app', { accountId: accountA.id }, (c) =>
      c.query('SELECT profile_id FROM title_ratings'),
    );
    expect(visible.rows.every((r) => r.profile_id === adultA.id)).toBe(true);
    await expect(
      asRole(t.pool, 'ad_app', { accountId: accountA.id }, (c) =>
        c.query('INSERT INTO title_ratings (profile_id, video_id, value) VALUES ($1, $2, 1)', [adultB.id, seriesId.replace(/.$/, '8')]),
      ),
    ).rejects.toThrow();
    const none = await asRole(t.pool, 'ad_app', {}, (c) => c.query('SELECT 1 FROM title_ratings'));
    expect(none.rowCount).toBe(0);
  });

  it('the aggregate function returns counts without profile ids, and the worker cannot read the table', async () => {
    const rows = await asRole(t.pool, 'ad_worker', {}, (c) => c.query('SELECT * FROM title_rating_aggregate()'));
    expect(rows.rows.length).toBeGreaterThan(0);
    expect(Object.keys(rows.rows[0]).sort()).toEqual(['dislikes', 'likes', 'loves', 'series_id', 'video_id']);
    const forVideo = rows.rows.find((r) => r.video_id === video.id);
    expect(forVideo).toMatchObject({ dislikes: 1, loves: 1, likes: 0 });
    await expect(
      asRole(t.pool, 'ad_worker', {}, (c) => c.query('SELECT * FROM title_ratings')),
    ).rejects.toThrow(/permission denied/);
  });

  it('ratings are removed when a profile or a video is deleted', async () => {
    await t.pool.query('DELETE FROM profiles WHERE id = $1', [adultB.id]);
    expect((await t.pool.query('SELECT 1 FROM title_ratings WHERE profile_id = $1', [adultB.id])).rowCount).toBe(0);
    await t.pool.query('DELETE FROM videos WHERE id = $1', [video.id]);
    expect((await t.pool.query('SELECT 1 FROM title_ratings WHERE video_id = $1', [video.id])).rowCount).toBe(0);
  });

  it('title_rating_stats is readable by the app and writable by the worker only', async () => {
    await asRole(t.pool, 'ad_worker', {}, (c) =>
      c.query('INSERT INTO title_rating_stats (series_id, likes, loves, dislikes) VALUES ($1, 5, 5, 1)', [seriesId]),
    );
    const read = await asRole(t.pool, 'ad_app', { accountId: accountA.id }, (c) => c.query('SELECT likes FROM title_rating_stats'));
    expect(read.rows[0].likes).toBe(5);
    await expect(
      asRole(t.pool, 'ad_app', { accountId: accountA.id }, (c) => c.query('UPDATE title_rating_stats SET likes = 0')),
    ).rejects.toThrow(/permission denied/);
  });
});
