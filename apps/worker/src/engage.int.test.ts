import { createDb, schema } from '@ad/db';
import {
  createTestDatabase,
  integrationEnabled,
  makeAccount,
  makeProfile,
  makeVideo,
  type TestDatabase,
} from '@ad/db/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { DEFAULT_RATING_RULES, rollupRatings } from './engage';

describe.skipIf(!integrationEnabled())('ratings rollup (M44-S05)', () => {
  let t: TestDatabase;
  let workerPool: TestDatabase['pool'];
  let worker: ReturnType<typeof createDb>;
  let videoA: string;
  let videoB: string;

  async function rate(videoId: string, values: number[]) {
    for (const value of values) {
      const account = makeAccount();
      await t.db.insert(schema.accounts).values(account);
      const profile = makeProfile(account.id, { isPrimary: true });
      await t.db.insert(schema.profiles).values(profile);
      await t.db.insert(schema.titleRatings).values({ profileId: profile.id, videoId, value });
    }
  }
  const stats = async () =>
    (
      await t.pool.query(
        'SELECT video_id, likes, loves, dislikes, most_liked FROM title_rating_stats ORDER BY video_id',
      )
    ).rows;

  beforeAll(async () => {
    t = await createTestDatabase();
    const PoolClass = t.pool.constructor as new (config: object) => TestDatabase['pool'];
    workerPool = new PoolClass({ connectionString: t.url, max: 2, options: '-c role=ad_worker' });
    worker = createDb(workerPool);
    const a = makeVideo();
    const b = makeVideo();
    await t.db.insert(schema.videos).values([a, b]);
    videoA = a.id;
    videoB = b.id;
  });
  afterAll(async () => {
    await workerPool?.end();
    await t?.drop();
  });

  it('counts likes, loves and dislikes per title and labels Most liked within the rules', async () => {
    await rate(videoA, [...Array(8).fill(1), ...Array(4).fill(2), -1]);
    await rate(videoB, [1, 1, -1]);
    const result = await rollupRatings(worker, DEFAULT_RATING_RULES);
    expect(result).toMatchObject({ titles: 2, labelled: 1 });
    const rows = await stats();
    const a = rows.find((r) => r.video_id === videoA);
    const b = rows.find((r) => r.video_id === videoB);
    expect(a).toMatchObject({ likes: 8, loves: 4, dislikes: 1, most_liked: true });
    expect(b).toMatchObject({ likes: 2, loves: 0, dislikes: 1, most_liked: false });
  });

  it('rerunning the rollup does not change results', async () => {
    const before = await stats();
    await rollupRatings(worker, DEFAULT_RATING_RULES);
    await rollupRatings(worker, DEFAULT_RATING_RULES);
    expect(await stats()).toEqual(before);
  });

  it('removes stats when the ratings are gone', async () => {
    await t.pool.query('DELETE FROM title_ratings WHERE video_id = $1', [videoB]);
    await rollupRatings(worker, DEFAULT_RATING_RULES);
    const rows = await stats();
    expect(rows.map((r) => r.video_id)).toEqual([videoA]);
    await t.pool.query('DELETE FROM title_ratings');
    await rollupRatings(worker, DEFAULT_RATING_RULES);
    expect(await stats()).toEqual([]);
  });
});
