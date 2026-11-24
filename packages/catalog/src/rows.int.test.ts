import { rows as rowsTable, rowItems, videoDailyStats } from '@ad/db';
import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { expandRows, listPublishedRows, resolveRow, type RowDescriptor } from './rows';
import {
  categorize,
  createViewerTestDb,
  integrationEnabled,
  NOW,
  runAs,
  seedAccount,
  seedCategory,
  seedSeries,
  seedVideo,
  type ViewerTestDb,
} from './testing';
import type { Audience, CatalogContext } from './types';

const ctx: CatalogContext = { mediaOrigin: 'https://media.test', now: () => NOW };
const general: Audience = { kids: false };
const kids: Audience = { kids: true };
const rules = { trendingWindowDays: 7, autoCategoryMax: 6 };

describe.skipIf(!integrationEnabled())('home row resolution (M41-S05, M41-S08)', () => {
  let t: ViewerTestDb;
  let run: ReturnType<typeof runAs>;
  let position = 0;

  beforeAll(async () => {
    t = await createViewerTestDb();
    const account = await seedAccount(t.setup);
    run = runAs(t.app, { accountId: account.id, role: 'viewer' });
  });
  afterAll(async () => {
    await t?.drop();
  });

  async function clean() {
    await t.setup.execute(
      sql.raw(
        'TRUNCATE row_items, rows, video_daily_stats, video_categories, series_categories, categories, episodes, seasons, series, videos, assets CASCADE',
      ),
    );
    position = 0;
  }
  async function addRow(values: Partial<typeof rowsTable.$inferInsert> & { title: string }) {
    await t.setup
      .insert(rowsTable)
      .values({ kind: 'curated', isPublished: true, kidsVisible: true, position: position++, ...values });
  }
  const published = (audience: Audience = general) => run((tx) => listPublishedRows(tx, audience));
  const expanded = (audience: Audience = general) =>
    run(async (tx) => expandRows(tx, ctx, audience, await listPublishedRows(tx, audience), rules));
  const resolve = (row: RowDescriptor, audience: Audience = general) =>
    run((tx) => resolveRow(tx, ctx, audience, row, rules));
  const fill = async (category: { id: string }, count: number, prefix: string) => {
    for (let i = 0; i < count; i++) {
      const v = await seedVideo(t.setup, { title: `${prefix} ${i}`, publishedAt: new Date(`2026-05-0${i + 1}`) });
      await categorize(t.setup, { videoId: v.id }, category.id);
    }
  };

  it('Trending is hidden under its minimum and never copies New', async () => {
    await clean();
    for (let i = 1; i <= 5; i++) await seedVideo(t.setup, { title: `V${i}`, publishedAt: new Date(`2026-05-0${i}`) });
    const [a, b] = await t.setup.execute(sql`SELECT id FROM videos ORDER BY title LIMIT 2`).then((r) => r.rows as { id: string }[]);
    await t.setup.insert(videoDailyStats).values([
      { videoId: a!.id, day: '2026-06-12', views: 9 },
      { videoId: b!.id, day: '2026-06-12', views: 5 },
    ]);
    await addRow({ title: 'Trending', kind: 'popular', minItems: 4 });
    const [row] = await published();
    const trending = await resolve(row!);
    expect(trending.cards).toEqual([]);
    await addRow({ title: 'Trending relaxed', kind: 'popular', minItems: 2 });
    const [, relaxed] = await published();
    expect((await resolve(relaxed!)).cards.map((c) => c.title)).toEqual(['V1', 'V2']);
  });

  it('Trending counts views only inside the window', async () => {
    await clean();
    const v = await seedVideo(t.setup, { title: 'Old views' });
    await t.setup.insert(videoDailyStats).values({ videoId: v.id, day: '2026-06-01', views: 99 });
    await addRow({ title: 'Trending', kind: 'popular' });
    const [row] = await published();
    expect((await resolve(row!)).cards).toEqual([]);
  });

  it('every row kind in automatic mode carries its View all target', async () => {
    await clean();
    const farm = await seedCategory(t.setup, 'Farming');
    await fill(farm, 1, 'F');
    const [seen] = await t.setup.execute(sql`SELECT id FROM videos LIMIT 1`).then((r) => r.rows as { id: string }[]);
    await t.setup.insert(videoDailyStats).values({ videoId: seen!.id, day: '2026-06-12', views: 3 });
    await addRow({ title: 'New', kind: 'recently_added' });
    await addRow({ title: 'Trending', kind: 'popular' });
    await addRow({ title: 'Farming', kind: 'category', categoryId: farm.id });
    await addRow({ title: 'Start here', slug: 'start-here' });
    const [manual] = await t.setup.execute(sql`SELECT id FROM rows WHERE slug = 'start-here'`).then((r) => r.rows as { id: string }[]);
    await t.setup.insert(rowItems).values({ rowId: manual!.id, position: 0, videoId: seen!.id });
    const hrefs = [];
    for (const row of await published()) hrefs.push((await resolve(row)).viewAll?.href ?? null);
    expect(hrefs).toEqual(['/browse/new', '/browse/trending', '/browse/farming', '/browse/row/start-here']);
  });

  it('custom and none modes override the automatic target', async () => {
    await clean();
    await seedVideo(t.setup, { title: 'One' });
    await addRow({ title: 'New', kind: 'recently_added', viewAllMode: 'custom', viewAllUrl: 'https://example.org/p' });
    await addRow({ title: 'New 2', kind: 'recently_added', viewAllMode: 'none' });
    const [custom, none] = await published();
    expect((await resolve(custom!)).viewAll).toEqual({ href: 'https://example.org/p', external: true });
    expect((await resolve(none!)).viewAll).toBeNull();
  });

  it('a series section links to its series page', async () => {
    await clean();
    const series = await seedSeries(t.setup, { series: { title: 'Nile' } });
    await addRow({ title: 'Nile episodes', seriesId: series.id });
    const [row] = await published();
    expect(row!.seriesSlug).toBe(series.slug);
    expect((await resolve(row!)).viewAll?.href).toBe(`/series/${series.slug}`);
  });

  it('each_category expands categories with enough live titles in order, skipping ones with their own row', async () => {
    await clean();
    const health = await seedCategory(t.setup, 'Health', { position: 1 });
    const money = await seedCategory(t.setup, 'Money', { position: 2 });
    const tiny = await seedCategory(t.setup, 'Tiny', { position: 3 });
    const farm = await seedCategory(t.setup, 'Farming', { position: 4 });
    await fill(health, 4, 'H');
    await fill(money, 4, 'M');
    await fill(tiny, 2, 'T');
    await fill(farm, 4, 'F');
    await addRow({ title: 'Farming own', kind: 'category', categoryId: farm.id });
    await addRow({ title: 'Browse by subject', kind: 'each_category', minItems: 4 });
    const result = await expanded();
    expect(result.map((r) => r.title)).toEqual(['Farming own', 'Health', 'Money']);
    expect(result[1]).toMatchObject({ kind: 'category', categorySlug: 'health', viewAllMode: 'auto' });
    expect((await resolve(result[1]!)).viewAll?.href).toBe('/browse/health');
  });

  it('each_category honours the cap and the kids audience', async () => {
    await clean();
    for (let i = 1; i <= 4; i++) {
      const c = await seedCategory(t.setup, `Cat ${i}`, { position: i });
      for (let j = 0; j < 4; j++) {
        const v = await seedVideo(t.setup, { title: `C${i}V${j}`, kidsSafe: i === 1 });
        await categorize(t.setup, { videoId: v.id }, c.id);
      }
    }
    await addRow({ title: 'Subjects', kind: 'each_category', minItems: 4 });
    const capped = await run(async (tx) =>
      expandRows(tx, ctx, general, await listPublishedRows(tx, general), { ...rules, autoCategoryMax: 2 }),
    );
    expect(capped.map((r) => r.title)).toEqual(['Cat 1', 'Cat 2']);
    expect((await expanded(kids)).map((r) => r.title)).toEqual(['Cat 1']);
  });

  it('all_series shows series cards and hides under its minimum', async () => {
    await clean();
    await seedSeries(t.setup, { series: { title: 'One' } });
    await addRow({ title: 'Series', kind: 'all_series', minItems: 2 });
    const [row] = await published();
    expect((await resolve(row!)).cards).toEqual([]);
    await seedSeries(t.setup, { series: { title: 'Two' } });
    const resolved = await resolve(row!);
    expect(resolved.cards.map((c) => c.kind)).toEqual(['series', 'series']);
    expect(resolved.viewAll?.href).toBe('/browse/series');
  });

  it('listPublishedRows returns link fields', async () => {
    await clean();
    await addRow({ title: 'Picks', slug: 'picks', minItems: 3, viewAllMode: 'custom', viewAllUrl: '/browse/x' });
    const [row] = await published();
    expect(row).toMatchObject({ slug: 'picks', minItems: 3, viewAllMode: 'custom', viewAllUrl: '/browse/x' });
  });
});
