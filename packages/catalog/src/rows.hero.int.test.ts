import { rowItems, rows } from '@ad/db';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { sql } from 'drizzle-orm';
import { heroCards, heroSlideExtras, listPublishedRows } from './rows';
import {
  createViewerTestDb,
  integrationEnabled,
  NOW,
  runAs,
  seedAccount,
  seedAsset,
  seedSeries,
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

  describe('slide extras', () => {
    const extras = (audience: Audience = general) =>
      run(async (tx) => {
        const descriptors = await listPublishedRows(tx, audience);
        const cards = await heroCards(tx, ctx, audience, descriptors);
        return { cards, map: await heroSlideExtras(tx, ctx, descriptors, cards) };
      });
    const heroRow = async (items: Partial<typeof rowItems.$inferInsert>[]) => {
      const [row] = await t.setup
        .insert(rows)
        .values({ kind: 'hero', title: 'Banner', isPublished: true, position: 0 })
        .returning();
      await t.setup
        .insert(rowItems)
        .values(items.map((item, position) => ({ rowId: row!.id, position, ...item })));
    };
    const ready = { previewState: 'ready', previewKey: 'cap/abc/preview/clip.mp4' };

    it('carries the editor text for a chosen slide and nothing for the others', async () => {
      await clean();
      const a = await seedVideo(t.setup, { title: 'A' });
      const b = await seedVideo(t.setup, { title: 'B' });
      await heroRow([
        { videoId: a.id, heroHeadline: 'Start here', heroButtonLabel: 'Play now' },
        { videoId: b.id },
      ]);
      const { map } = await extras();
      expect(map.get(a.id)).toMatchObject({ headline: 'Start here', blurb: null, buttonLabel: 'Play now' });
      expect(map.get(b.id)).toMatchObject({ headline: null, blurb: null, buttonLabel: null });
    });

    it('gives a clip url only when the clip is ready and the mode is not off', async () => {
      await clean();
      const on = await seedVideo(t.setup, { title: 'On', ...ready });
      const off = await seedVideo(t.setup, { title: 'Off', ...ready, previewMode: 'off' });
      const queued = await seedVideo(t.setup, { title: 'Queued', previewState: 'queued' });
      await heroRow([{ videoId: on.id }, { videoId: off.id }, { videoId: queued.id }]);
      const { map } = await extras();
      expect(map.get(on.id)?.previewUrl).toBe('https://media.test/cap/abc/preview/clip.mp4');
      expect(map.get(on.id)?.previewMs).toBe(6000);
      expect(map.get(on.id)?.previewHasAudio).toBe(false);
      expect(map.get(off.id)?.previewUrl).toBeNull();
      expect(map.get(queued.id)?.previewUrl).toBeNull();
    });

    it('reports the stored clip length and whether it has sound, and treats an old clip as silent and 6 seconds', async () => {
      await clean();
      const fresh = await seedVideo(t.setup, { title: 'Fresh', ...ready, previewHasAudio: true, previewLengthMs: 20_000 });
      const old = await seedVideo(t.setup, { title: 'Old', ...ready });
      await heroRow([{ videoId: fresh.id }, { videoId: old.id }]);
      const { map } = await extras();
      expect(map.get(fresh.id)).toMatchObject({ previewMs: 20_000, previewHasAudio: true });
      expect(map.get(old.id)).toMatchObject({ previewMs: 6000, previewHasAudio: false });
    });

    it('uses the first episode clip for a series', async () => {
      await clean();
      const s = await seedSeries(t.setup, { episode: { previewState: 'none' } });
      await t.setup.execute(
        sql`UPDATE videos SET preview_state = 'ready', preview_key = 'cap/ep1/preview/clip.mp4'
            WHERE id = ${s.episodes[0]!.id}::uuid`,
      );
      await heroRow([{ seriesId: s.id }]);
      const { map } = await extras();
      expect(map.get(s.id)?.previewUrl).toBe('https://media.test/cap/ep1/preview/clip.mp4');
    });

    it('has a clip but no text for the newest fallback titles', async () => {
      await clean();
      const v = await seedVideo(t.setup, { title: 'Newest', ...ready });
      const { map } = await extras();
      expect(map.get(v.id)).toMatchObject({ headline: null, previewUrl: expect.stringContaining('clip.mp4') });
    });
  });
});
