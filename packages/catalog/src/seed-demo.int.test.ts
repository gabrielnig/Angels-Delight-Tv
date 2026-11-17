import { count } from 'drizzle-orm';
import { rows, series, videos } from '@ad/db';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { clearDemo, seedDemo } from './seed-demo';
import { listCategories, listTitles } from './titles';
import {
  createViewerTestDb,
  integrationEnabled,
  NOW,
  runAs,
  seedAccount,
  type ViewerTestDb,
} from './testing';

describe.skipIf(!integrationEnabled())('demo seed', () => {
  let t: ViewerTestDb;
  beforeAll(async () => {
    t = await createViewerTestDb();
  });
  afterAll(async () => {
    await t?.drop();
  });

  it('creates 30 titles, 3 series, categories and rows, and a second run changes nothing', async () => {
    const first = await seedDemo(t.setup, NOW);
    expect(first).toMatchObject({ created: true, series: 3, categories: 5 });
    const second = await seedDemo(t.setup, NOW);
    expect(second.created).toBe(false);
    const [v] = await t.setup.select({ n: count() }).from(videos);
    expect(v!.n).toBe(30 + 12);
    expect((await t.setup.select({ n: count() }).from(series))[0]!.n).toBe(3);
    expect((await t.setup.select({ n: count() }).from(rows))[0]!.n).toBe(6);
  });

  it('is visible to a viewer and clears cleanly', async () => {
    const account = await seedAccount(t.setup);
    const run = runAs(t.app, { accountId: account.id, role: 'viewer' });
    const ctx = { mediaOrigin: 'https://media.test', now: () => NOW };
    const page = await run((tx) =>
      listTitles(tx, ctx, { kids: false }, { sort: 'newest', limit: 60 }),
    );
    expect(page.items.length).toBe(33);
    const cats = await run((tx) => listCategories(tx, ctx, { kids: false }));
    expect(cats).toHaveLength(5);
    await clearDemo(t.setup);
    expect((await t.setup.select({ n: count() }).from(videos))[0]!.n).toBe(0);
  });
});
