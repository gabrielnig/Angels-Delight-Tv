import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  categorize,
  createViewerTestDb,
  integrationEnabled,
  NOW,
  runAs,
  seedAccount,
  seedAsset,
  seedCategory,
  seedSeries,
  seedVideo,
  type ViewerTestDb,
} from './testing';
import {
  fetchCards,
  listCategories,
  listTitles,
  relatedTitles,
  searchTitles,
  suggestTitles,
} from './titles';
import type { Audience, CatalogContext } from './types';

const ctx: CatalogContext = { mediaOrigin: 'https://media.test', now: () => NOW };
const general: Audience = { kids: false };
const kids: Audience = { kids: true };

describe.skipIf(!integrationEnabled())('title queries', () => {
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

  describe('fetchCards', () => {
    it('returns visible titles with poster urls and skips hidden ones', async () => {
      const poster = await seedAsset(t.setup);
      const shown = await seedVideo(t.setup, { title: 'Shown card', posterAssetId: poster });
      const draft = await seedVideo(t.setup, { title: 'Draft card', publishState: 'draft' });
      const shownSeries = await seedSeries(t.setup, { series: { title: 'Series card' } });

      const cards = await run((tx) =>
        fetchCards(tx, ctx, general, [
          { kind: 'video', id: shown.id },
          { kind: 'video', id: draft.id },
          { kind: 'series', id: shownSeries.id },
        ]),
      );

      expect(cards.map((card) => card.title)).toEqual(['Shown card', 'Series card']);
      expect(cards[0]?.poster?.variants[0]?.url).toBe(
        `https://media.test/img/${poster}/320-aaaaaaaa.webp`,
      );
      expect(cards[0]?.poster?.placeholderColor).toBe('#1F6FB5');
      expect(cards[1]).toMatchObject({ kind: 'series', episodeCount: 3, durationMs: null });
    });

    it('carries the first visible category by position and the publish date', async () => {
      const later = await seedCategory(t.setup, 'Card later', { position: 20 });
      const first = await seedCategory(t.setup, 'Card first', { position: 5 });
      const hidden = await seedCategory(t.setup, 'Card hidden', { position: 1, isVisible: false });
      const video = await seedVideo(t.setup, { title: 'With category' });
      for (const c of [later, first, hidden]) await categorize(t.setup, { videoId: video.id }, c.id);
      const [card] = await run((tx) => fetchCards(tx, ctx, general, [{ kind: 'video', id: video.id }]));
      expect(card).toMatchObject({
        categorySlug: first.slug,
        categoryName: 'Card first',
        publishedAt: expect.stringMatching(/^2026-05-01T09:00:00/),
      });
    });

    it('carries the series labels on a series card and null on a video (M50)', async () => {
      const video = await seedVideo(t.setup, { title: 'Labels video' });
      const own = await seedSeries(t.setup, {
        series: { title: 'Labels series', labelOverrides: { preset: 'book_chapter' } },
      });
      const plain = await seedSeries(t.setup, { series: { title: 'Plain labels series' } });
      const cards = await run((tx) =>
        fetchCards(tx, ctx, general, [
          { kind: 'video', id: video.id },
          { kind: 'series', id: own.id },
          { kind: 'series', id: plain.id },
        ]),
      );
      expect(cards.map((c) => c.labels)).toEqual([
        null,
        { preset: 'book_chapter' },
        { preset: 'season_episode' },
      ]);
    });

    it('carries the maturity rank of videos and series, null when unrated (M44-S13)', async () => {
      const rated = await seedVideo(t.setup, { title: 'Rated card', maturityRank: 3, kidsSafe: false });
      const unrated = await seedVideo(t.setup, { title: 'Unrated card', maturityRank: null, kidsSafe: false });
      const series = await seedSeries(t.setup, { series: { title: 'Rated series card', maturityRank: 1 } });
      const cards = await run((tx) =>
        fetchCards(tx, ctx, general, [
          { kind: 'video', id: rated.id },
          { kind: 'video', id: unrated.id },
          { kind: 'series', id: series.id },
        ]),
      );
      expect(cards.map((card) => card.maturityRank)).toEqual([3, null, 1]);
    });

    it('gives null category fields when the title has no visible category', async () => {
      const video = await seedVideo(t.setup, { title: 'No category' });
      const [card] = await run((tx) => fetchCards(tx, ctx, general, [{ kind: 'video', id: video.id }]));
      expect(card).toMatchObject({ categorySlug: null, categoryName: null });
      expect(card?.publishedAt).not.toBeNull();
    });

    it('keeps the order of the requested references', async () => {
      const first = await seedVideo(t.setup, { title: 'Order first' });
      const second = await seedVideo(t.setup, { title: 'Order second' });

      const cards = await run((tx) =>
        fetchCards(tx, ctx, general, [
          { kind: 'video', id: second.id },
          { kind: 'video', id: first.id },
        ]),
      );

      expect(cards.map((card) => card.title)).toEqual(['Order second', 'Order first']);
    });

    it('does not return episodes as titles of their own', async () => {
      const series = await seedSeries(t.setup);

      const cards = await run((tx) =>
        fetchCards(tx, ctx, general, [{ kind: 'video', id: series.episodes[0]!.id }]),
      );

      expect(cards).toEqual([]);
    });

    it('returns nothing unfiltered for a kids audience', async () => {
      const adult = await seedVideo(t.setup, { kidsSafe: false });
      const child = await seedVideo(t.setup, { kidsSafe: true });

      const cards = await run((tx) =>
        fetchCards(tx, ctx, kids, [
          { kind: 'video', id: adult.id },
          { kind: 'video', id: child.id },
        ]),
      );

      expect(cards.map((card) => card.id)).toEqual([child.id]);
    });
  });

  describe('browse', () => {
    const published = (day: number) => new Date(Date.UTC(2026, 0, day));

    it('lists the titles of one category, newest first, across pages', async () => {
      const category = await seedCategory(t.setup, 'Money skills');
      for (let day = 1; day <= 5; day++) {
        const video = await seedVideo(t.setup, {
          title: `Money lesson ${day}`,
          publishedAt: published(day),
        });
        await categorize(t.setup, { videoId: video.id }, category.id);
      }
      await seedVideo(t.setup, { title: 'Unrelated lesson' });

      const first = await run((tx) =>
        listTitles(tx, ctx, general, { categorySlug: category.slug, sort: 'newest', limit: 2 }),
      );
      const second = await run((tx) =>
        listTitles(tx, ctx, general, {
          categorySlug: category.slug,
          sort: 'newest',
          limit: 2,
          cursor: first.nextCursor!,
        }),
      );
      const third = await run((tx) =>
        listTitles(tx, ctx, general, {
          categorySlug: category.slug,
          sort: 'newest',
          limit: 2,
          cursor: second.nextCursor!,
        }),
      );

      expect(first.items.map((card) => card.title)).toEqual(['Money lesson 5', 'Money lesson 4']);
      expect(second.items.map((card) => card.title)).toEqual(['Money lesson 3', 'Money lesson 2']);
      expect(third.items.map((card) => card.title)).toEqual(['Money lesson 1']);
      expect(third.nextCursor).toBeNull();
    });

    it('sorts A to Z and shortest first, and filters by duration bucket', async () => {
      const category = await seedCategory(t.setup, 'Sorting');
      const specs = [
        { title: 'Charlie', durationMs: 60_000 },
        { title: 'alpha', durationMs: 400_000 },
        { title: 'Bravo', durationMs: 200_000 },
      ];
      for (const spec of specs) {
        const video = await seedVideo(t.setup, spec);
        await categorize(t.setup, { videoId: video.id }, category.id);
      }
      const titlesFor = async (input: Parameters<typeof listTitles>[3]) =>
        (
          await run((tx) => listTitles(tx, ctx, general, { categorySlug: category.slug, ...input }))
        ).items.map((card) => card.title);

      expect(await titlesFor({ sort: 'az' })).toEqual(['alpha', 'Bravo', 'Charlie']);
      expect(await titlesFor({ sort: 'shortest' })).toEqual(['Charlie', 'Bravo', 'alpha']);
      expect(await titlesFor({ sort: 'longest' })).toEqual(['alpha', 'Bravo', 'Charlie']);
      const firstLongest = await run((tx) =>
        listTitles(tx, ctx, general, { categorySlug: category.slug, sort: 'longest', limit: 2 }),
      );
      const restLongest = await run((tx) =>
        listTitles(tx, ctx, general, {
          categorySlug: category.slug,
          sort: 'longest',
          limit: 2,
          cursor: firstLongest.nextCursor!,
        }),
      );
      expect(restLongest.items.map((card) => card.title)).toEqual(['Charlie']);
      expect(await titlesFor({ sort: 'newest', duration: 'short' })).toEqual(['Charlie']);
      expect(await titlesFor({ sort: 'newest', duration: 'medium' })).toEqual(['Bravo']);
      expect(await titlesFor({ sort: 'newest', duration: 'long' })).toEqual(['alpha']);
    });

    it('mixes standalone videos and series in one list', async () => {
      const category = await seedCategory(t.setup, 'Mixed');
      const video = await seedVideo(t.setup, { title: 'Mixed video' });
      const series = await seedSeries(t.setup, { series: { title: 'Mixed series' } });
      await categorize(t.setup, { videoId: video.id }, category.id);
      await categorize(t.setup, { seriesId: series.id }, category.id);

      const page = await run((tx) =>
        listTitles(tx, ctx, general, { categorySlug: category.slug, sort: 'az' }),
      );

      expect(page.items.map((card) => `${card.kind}:${card.title}`)).toEqual([
        'series:Mixed series',
        'video:Mixed video',
      ]);
    });

    it('returns an empty page for an unknown or hidden category', async () => {
      const hidden = await seedCategory(t.setup, 'Hidden shelf', { isVisible: false });
      const video = await seedVideo(t.setup);
      await categorize(t.setup, { videoId: video.id }, hidden.id);

      const viaHidden = await run((tx) =>
        listTitles(tx, ctx, general, { categorySlug: hidden.slug, sort: 'newest' }),
      );
      const viaUnknown = await run((tx) =>
        listTitles(tx, ctx, general, { categorySlug: 'no-such-shelf', sort: 'newest' }),
      );

      expect(viaHidden.items).toEqual([]);
      expect(viaUnknown.items).toEqual([]);
    });

    it('shows a kids audience only kids safe titles in a category', async () => {
      const category = await seedCategory(t.setup, 'Family time');
      const adult = await seedVideo(t.setup, { title: 'Adult only', kidsSafe: false });
      const child = await seedVideo(t.setup, { title: 'For children', kidsSafe: true });
      await categorize(t.setup, { videoId: adult.id }, category.id);
      await categorize(t.setup, { videoId: child.id }, category.id);

      const page = await run((tx) =>
        listTitles(tx, ctx, kids, { categorySlug: category.slug, sort: 'newest' }),
      );

      expect(page.items.map((card) => card.title)).toEqual(['For children']);
    });

    it('rejects a cursor that was not issued by the service', async () => {
      await expect(
        run((tx) => listTitles(tx, ctx, general, { sort: 'newest', cursor: 'not-a-cursor' })),
      ).rejects.toMatchObject({ code: 'validation_failed' });
    });
  });

  describe('categories', () => {
    it('lists categories that have a live title and hides the rest', async () => {
      const filled = await seedCategory(t.setup, 'Filled shelf', { position: 1 });
      const emptyShelf = await seedCategory(t.setup, 'Empty shelf', { position: 2 });
      const draftOnly = await seedCategory(t.setup, 'Draft only shelf', { position: 3 });
      const switchedOff = await seedCategory(t.setup, 'Switched off shelf', {
        position: 4,
        isVisible: false,
      });
      const live = await seedVideo(t.setup);
      const draft = await seedVideo(t.setup, { publishState: 'draft' });
      await categorize(t.setup, { videoId: live.id }, filled.id);
      await categorize(t.setup, { videoId: draft.id }, draftOnly.id);
      await categorize(t.setup, { videoId: live.id }, switchedOff.id);

      const slugs = (await run((tx) => listCategories(tx, ctx, general))).map((c) => c.slug);

      expect(slugs).toContain(filled.slug);
      expect(slugs).not.toContain(emptyShelf.slug);
      expect(slugs).not.toContain(draftOnly.slug);
      expect(slugs).not.toContain(switchedOff.slug);
    });

    it('lists a category for kids only when it holds a kids safe live title', async () => {
      const adultShelf = await seedCategory(t.setup, 'Adult shelf');
      const kidsShelf = await seedCategory(t.setup, 'Kids shelf');
      const adult = await seedVideo(t.setup, { kidsSafe: false });
      const child = await seedVideo(t.setup, { kidsSafe: true });
      await categorize(t.setup, { videoId: adult.id }, adultShelf.id);
      await categorize(t.setup, { videoId: child.id }, kidsShelf.id);

      const slugs = (await run((tx) => listCategories(tx, ctx, kids))).map((c) => c.slug);

      expect(slugs).toContain(kidsShelf.slug);
      expect(slugs).not.toContain(adultShelf.slug);
    });
  });

  describe('search', () => {
    const search = (audience: Audience, query: string, extra = {}) =>
      run((tx) => searchTitles(tx, ctx, audience, { query, ...extra }));

    beforeAll(async () => {
      const shelf = await seedCategory(t.setup, 'Entrepreneurship');
      await seedVideo(t.setup, { title: 'Cafe Basics', description: 'Running a small shop' });
      await seedVideo(t.setup, {
        title: 'Café Accounts',
        description: 'Daily sales records for a cafe',
      });
      await seedVideo(t.setup, { title: 'Budgeting Basics', description: 'Plan your month' });
      await seedVideo(t.setup, { title: 'Saving habits', description: 'Plan around budgeting' });
      await seedVideo(t.setup, { title: 'Oúnjẹ Yorùbá', description: 'Ẹ kú àbọ̀' });
      await seedVideo(t.setup, {
        title: 'Wahala dey',
        description: 'How we dey solve am for pidgin',
      });
      await seedVideo(t.setup, {
        title: 'Kids only counting',
        description: 'Numbers',
        kidsSafe: true,
      });
      await seedVideo(t.setup, { title: 'Hidden budgeting draft', publishState: 'draft' });
      const startup = await seedVideo(t.setup, { title: 'Starting out' });
      await categorize(t.setup, { videoId: startup.id }, shelf.id);
      await seedSeries(t.setup, { series: { title: 'Budgeting series' } });
    });

    it('matches regardless of accents and case', async () => {
      const titles = (await search(general, 'CAFE')).items.map((card) => card.title);

      expect(titles).toContain('Cafe Basics');
      expect(titles).toContain('Café Accounts');
    });

    it('matches accented titles from an unaccented query', async () => {
      const titles = (await search(general, 'ounje yoruba')).items.map((card) => card.title);

      expect(titles).toEqual(['Oúnjẹ Yorùbá']);
    });

    it('ranks title matches above description matches', async () => {
      const titles = (await search(general, 'budgeting')).items.map((card) => card.title);

      expect(titles.indexOf('Budgeting Basics')).toBeLessThan(titles.indexOf('Saving habits'));
      expect(titles).toContain('Budgeting series');
    });

    it('tolerates a typo through trigram similarity', async () => {
      const titles = (await search(general, 'budgetng')).items.map((card) => card.title);

      expect(titles).toContain('Budgeting Basics');
    });

    it('matches the start of a word while the viewer is still typing', async () => {
      const titles = (await search(general, 'budg')).items.map((card) => card.title);

      expect(titles).toContain('Budgeting Basics');
    });

    it('finds titles by category name', async () => {
      const titles = (await search(general, 'entrepreneurship')).items.map((card) => card.title);

      expect(titles).toEqual(['Starting out']);
    });

    it('does not stem Pidgin words away', async () => {
      const titles = (await search(general, 'wahala')).items.map((card) => card.title);

      expect(titles).toEqual(['Wahala dey']);
    });

    it('never returns unpublished titles', async () => {
      const titles = (await search(general, 'hidden budgeting')).items.map((card) => card.title);

      expect(titles).not.toContain('Hidden budgeting draft');
    });

    it('filters a kids audience in the query', async () => {
      const kidsTitles = (await search(kids, 'counting')).items.map((card) => card.title);
      const kidsOtherTitles = (await search(kids, 'budgeting')).items;

      expect(kidsTitles).toEqual(['Kids only counting']);
      expect(kidsOtherTitles).toEqual([]);
    });

    it.each(["'; DROP TABLE videos; --", '& | ! : * ( )', '\\', '%%%', 'a b c d e f g h i j k l'])(
      'treats %j as plain text',
      async (hostile) => {
        await expect(search(general, hostile)).resolves.toMatchObject({ items: expect.any(Array) });
        const count = await t.setup.execute(sql`SELECT count(*) AS n FROM videos`);
        expect(Number((count as unknown as { rows: { n: string }[] }).rows[0]?.n)).toBeGreaterThan(
          5,
        );
      },
    );

    it('pages by cursor and reports the total', async () => {
      const page = await search(general, 'basics', { limit: 1 });
      const next = await search(general, 'basics', { limit: 1, cursor: page.nextCursor! });

      expect(page.total).toBe(2);
      expect(page.items).toHaveLength(1);
      expect(next.items).toHaveLength(1);
      expect(next.items[0]?.id).not.toBe(page.items[0]?.id);
      expect(next.nextCursor).toBeNull();
    });

    it('returns an empty page for a query with no usable characters', async () => {
      expect((await search(general, '!!')).items).toEqual([]);
    });
  });

  describe('suggestions', () => {
    it('offers up to five title and category suggestions for a prefix', async () => {
      await seedCategory(t.setup, 'Suggestible shelf');
      const video = await seedVideo(t.setup, { title: 'Suggestible video' });
      await categorize(
        t.setup,
        { videoId: video.id },
        (await seedCategory(t.setup, 'Suggestible tools')).id,
      );

      const suggestions = await run((tx) => suggestTitles(tx, ctx, general, 'sugges'));

      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions.length).toBeLessThanOrEqual(5);
      expect(suggestions.map((s) => s.label)).toContain('Suggestible video');
      expect(suggestions.map((s) => s.label)).toContain('Suggestible tools');
    });

    it('applies the kids filter to suggestions', async () => {
      await seedVideo(t.setup, { title: 'Zebra grown up talk', kidsSafe: false });
      await seedVideo(t.setup, { title: 'Zebra stripes song', kidsSafe: true });

      const labels = (await run((tx) => suggestTitles(tx, ctx, kids, 'zebra'))).map((s) => s.label);

      expect(labels).toEqual(['Zebra stripes song']);
    });
  });

  describe('related titles', () => {
    it('returns live titles that share a category, never the title itself', async () => {
      const shelf = await seedCategory(t.setup, 'Related shelf');
      const base = await seedVideo(t.setup, { title: 'Related base' });
      const sibling = await seedVideo(t.setup, { title: 'Related sibling' });
      const hiddenSibling = await seedVideo(t.setup, {
        title: 'Related hidden',
        publishState: 'draft',
      });
      const stranger = await seedVideo(t.setup, { title: 'Related stranger' });
      for (const video of [base, sibling, hiddenSibling]) {
        await categorize(t.setup, { videoId: video.id }, shelf.id);
      }

      const related = await run((tx) =>
        relatedTitles(tx, ctx, general, { kind: 'video', id: base.id }),
      );

      expect(related.map((card) => card.title)).toEqual(['Related sibling']);
      expect(related.map((card) => card.id)).not.toContain(stranger.id);
    });
  });
});
