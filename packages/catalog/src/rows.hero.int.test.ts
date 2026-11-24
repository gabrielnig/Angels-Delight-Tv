import { rowItems, rows } from '@ad/db';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { sql } from 'drizzle-orm';
import { heroCards, listPublishedRows } from './rows';
import {
  createViewerTestDb,
  integrationEnabled,
  NOW,
  runAs,
  seedAccount,
  seedAsset,
  seedVideo,
  type ViewerTestDb,
} from './testing';
import type { Audience, CatalogContext } from './types';

const ctx: CatalogContext = { mediaOrigin: 'https://media.test', now: () => NOW };
const general: Audience = { kids: false };
const kids: Audience = { kids: true };

describe.skipIf(!integrationEnabled())('hero cards', () => {
  let t: ViewerTestDb;
  let run: ReturnType<typeof runAs>;

  beforeAll(async () => {
    t = await createViewerTestDb();
    const account = await seedAccount(t.setup);
    run = runAs(t.app, { accountId: account.id, role: 'viewer' });
  });
  afterAll(async () => {
    await t?.drop();
  });

  async function clean() {
    await t.setup.execute(sql.raw('TRUNCATE row_items, rows, videos, assets CASCADE'));
  }

  const titles = (audience: Audience, count?: number) =>
    run(async (tx) => {
      const descriptors = await listPublishedRows(tx, audience);
      const cards = await heroCards(tx, ctx, audience, descriptors, count);
      return cards.map((card) => card.title);
    });

  it('returns the five newest live titles when no hero row exists', async () => {
    await clean();
    for (let day = 1; day <= 7; day++) {
      await seedVideo(t.setup, { title: `Title ${day}`, publishedAt: new Date(`2026-05-0${day}`) });
    }
    expect(await titles(general)).toEqual(['Title 7', 'Title 6', 'Title 5', 'Title 4', 'Title 3']);
  });

  it('uses the same fallback when every hero item is unpublished', async () => {
    await clean();
    const draft = await seedVideo(t.setup, { title: 'Draft', publishState: 'draft' });
    await seedVideo(t.setup, { title: 'Live', publishedAt: new Date('2026-05-02') });
    const [row] = await t.setup
      .insert(rows)
      .values({ kind: 'hero', title: 'Banner', isPublished: true, position: 0 })
      .returning();
    await t.setup.insert(rowItems).values({ rowId: row!.id, position: 0, videoId: draft.id });
    expect(await titles(general)).toEqual(['Live']);
  });

  it('keeps the editor choice when only two hero items are live', async () => {
    await clean();
    const a = await seedVideo(t.setup, { title: 'Chosen A', publishedAt: new Date('2026-01-01') });
    const b = await seedVideo(t.setup, { title: 'Chosen B', publishedAt: new Date('2026-01-02') });
    await seedVideo(t.setup, { title: 'Other', publishedAt: new Date('2026-05-02') });
    const [row] = await t.setup
      .insert(rows)
      .values({ kind: 'hero', title: 'Banner', isPublished: true, position: 0 })
      .returning();
    await t.setup.insert(rowItems).values([
      { rowId: row!.id, position: 0, videoId: b.id },
      { rowId: row!.id, position: 1, videoId: a.id },
    ]);
    expect(await titles(general)).toEqual(['Chosen B', 'Chosen A']);
  });

  it('only shows kids safe titles to a kids audience', async () => {
    await clean();
    await seedVideo(t.setup, {
      title: 'Adult',
      kidsSafe: false,
      publishedAt: new Date('2026-05-03'),
    });
    await seedVideo(t.setup, { title: 'Kid', kidsSafe: true, publishedAt: new Date('2026-05-01') });
    expect(await titles(kids)).toEqual(['Kid']);
  });

  it('sorts titles without artwork last and honours the count', async () => {
    await clean();
    const art = await seedAsset(t.setup);
    await seedVideo(t.setup, { title: 'Newest bare', publishedAt: new Date('2026-05-05') });
    await seedVideo(t.setup, {
      title: 'Older with art',
      posterAssetId: art,
      publishedAt: new Date('2026-05-02'),
    });
    await seedVideo(t.setup, {
      title: 'Oldest with art',
      posterAssetId: art,
      publishedAt: new Date('2026-05-01'),
    });
    expect(await titles(general)).toEqual(['Older with art', 'Oldest with art', 'Newest bare']);
    expect(await titles(general, 2)).toEqual(['Older with art', 'Oldest with art']);
  });
});
