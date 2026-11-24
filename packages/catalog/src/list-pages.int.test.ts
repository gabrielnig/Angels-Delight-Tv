import { rowItems, rows } from '@ad/db';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { sql } from 'drizzle-orm';
import { listRowPage, resolveRowBySlug } from './rows';
import {
  createViewerTestDb,
  integrationEnabled,
  NOW,
  runAs,
  seedAccount,
  seedVideo,
  type ViewerTestDb,
} from './testing';
import type { Audience, CatalogContext } from './types';

const ctx: CatalogContext = { mediaOrigin: 'https://media.test', now: () => NOW };
const general: Audience = { kids: false };
const kids: Audience = { kids: true };

describe.skipIf(!integrationEnabled())('list pages: curated row by slug', () => {
  let t: ViewerTestDb;
  let run: ReturnType<typeof runAs>;
  let nextPosition = 0;

  beforeAll(async () => {
    t = await createViewerTestDb();
    const account = await seedAccount(t.setup);
    run = runAs(t.app, { accountId: account.id, role: 'viewer' });
  });
  afterAll(async () => {
    await t?.drop();
  });

  async function makeRow(values: { slug: string; title: string; published?: boolean; kidsVisible?: boolean }) {
    const [row] = await t.setup
      .insert(rows)
      .values({
        kind: 'curated',
        title: values.title,
        slug: values.slug,
        isPublished: values.published ?? true,
        kidsVisible: values.kidsVisible ?? false,
        position: nextPosition++,
      })
      .returning();
    return row!;
  }

  it('finds a published row and lists its titles in editor order', async () => {
    await t.setup.execute(sql.raw('TRUNCATE row_items, rows, videos, assets CASCADE'));
    const a = await seedVideo(t.setup, { title: 'A', publishedAt: new Date('2026-05-01') });
    const b = await seedVideo(t.setup, { title: 'B', publishedAt: new Date('2026-05-02') });
    const row = await makeRow({ slug: 'picks', title: 'Our picks' });
    await t.setup.insert(rowItems).values([
      { rowId: row.id, position: 0, videoId: a.id },
      { rowId: row.id, position: 1, videoId: b.id },
    ]);
    const page = await run((tx) => listRowPage(tx, ctx, general, 'picks'));
    expect(page?.title).toBe('Our picks');
    expect(page?.cards.map((c) => c.title)).toEqual(['A', 'B']);
  });

  it('returns null for an unknown slug and for an unpublished row', async () => {
    await t.setup.execute(sql.raw('TRUNCATE row_items, rows, videos, assets CASCADE'));
    await makeRow({ slug: 'hidden', title: 'Hidden', published: false });
    expect(await run((tx) => resolveRowBySlug(tx, general, 'hidden'))).toBeNull();
    expect(await run((tx) => resolveRowBySlug(tx, general, 'nope'))).toBeNull();
  });

  it('hides a row that is not kids visible from a kids audience', async () => {
    await t.setup.execute(sql.raw('TRUNCATE row_items, rows, videos, assets CASCADE'));
    await makeRow({ slug: 'adults', title: 'Adults', kidsVisible: false });
    await makeRow({ slug: 'family', title: 'Family', kidsVisible: true });
    expect(await run((tx) => resolveRowBySlug(tx, kids, 'adults'))).toBeNull();
    expect((await run((tx) => resolveRowBySlug(tx, kids, 'family')))?.slug).toBe('family');
  });
});
