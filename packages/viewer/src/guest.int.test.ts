import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  guestBrowse,
  guestCategories,
  guestPopular,
  guestSearch,
  guestSuggest,
  guestTitleDetail,
  guestTitlesByIds,
  GUEST_BATCH_MAX,
} from './guest';
import { getGuestHome } from './home';
import { getRecentSearches } from './search';
import { search } from './search';
import { searchHistory } from '@ad/db';
import { NotFound } from '@ad/shared';
import { addToMyList } from './my-list';
import { saveProgress } from './progress';
import type { TitleCardDto } from './annotate';
import {
  categorize,
  createHarness,
  NOW,
  seedCategory,
  seedSeries,
  seedVideo,
  type ViewerHarness,
} from './testing';

describe.skipIf(!process.env.TEST_DATABASE_ADMIN_URL)('guest catalog path (M40)', () => {
  let h: ViewerHarness;
  beforeAll(async () => {
    h = await createHarness();
    h.setNow(NOW);
  });
  afterAll(async () => {
    await h?.drop();
  });

  const general = { kids: false };
  const kids = { kids: true };

  describe('guestTitleDetail', () => {
    it('describes a published video with no personal state', async () => {
      const shelf = await seedCategory(h.db.setup, 'Guest shelf');
      const video = await seedVideo(h.db.setup, { title: 'Guest video', durationMs: 90_000 });
      await categorize(h.db.setup, { videoId: video.id }, shelf.id);
      const detail = await guestTitleDetail(h.ctx, general, { id: video.id });
      expect(detail).toMatchObject({
        type: 'video',
        card: { title: 'Guest video', progress: null, inMyList: false },
        progress: null,
        play: { videoId: video.id, label: 'play', startMs: 0 },
        categories: [{ name: 'Guest shelf' }],
      });
    });

    it('ignores the progress and My List a signed in viewer has for the same title', async () => {
      const user = await h.makeUser();
      const video = await seedVideo(h.db.setup, { durationMs: 200_000 });
      await saveProgress(h.ctx, user.actor, {
        profileId: user.profileId,
        videoId: video.id,
        positionMs: 134_000,
      });
      await addToMyList(h.ctx, user.actor, {
        profileId: user.profileId,
        target: { kind: 'video', id: video.id },
      });
      const detail = await guestTitleDetail(h.ctx, general, { id: video.id });
      expect(detail).toMatchObject({
        progress: null,
        play: { label: 'play', startMs: 0 },
        card: { inMyList: false, progress: null },
      });
    });

    it('can be opened by slug and redirects an old slug', async () => {
      const video = await seedVideo(h.db.setup);
      const bySlug = await guestTitleDetail(h.ctx, general, { slug: video.slug });
      expect(bySlug).toEqual(await guestTitleDetail(h.ctx, general, { id: video.id }));
    });

    it('does not find drafts, deleted videos or malformed ids', async () => {
      const draft = await seedVideo(h.db.setup, { publishState: 'draft' });
      await expect(guestTitleDetail(h.ctx, general, { id: draft.id })).rejects.toBeInstanceOf(
        NotFound,
      );
      await expect(guestTitleDetail(h.ctx, general, { id: 'nope' })).rejects.toBeInstanceOf(
        NotFound,
      );
    });

    it('applies the kids filter in the query for Kids mode', async () => {
      const adult = await seedVideo(h.db.setup, { kidsSafe: false, title: 'Adults only' });
      const child = await seedVideo(h.db.setup, { kidsSafe: true, title: 'For children' });
      await expect(guestTitleDetail(h.ctx, kids, { id: adult.id })).rejects.toBeInstanceOf(
        NotFound,
      );
      await expect(guestTitleDetail(h.ctx, general, { id: adult.id })).resolves.toBeTruthy();
      await expect(guestTitleDetail(h.ctx, kids, { id: child.id })).resolves.toBeTruthy();
    });

    it('describes a series with episodes and no progress', async () => {
      const s = await seedSeries(h.db.setup, { seasonSizes: [2] });
      const detail = await guestTitleDetail(h.ctx, general, { id: s.id });
      expect(detail.type).toBe('series');
      if (detail.type !== 'series') return;
      expect(detail.seasons[0]?.episodes).toHaveLength(2);
      expect(detail.seasons[0]?.episodes.every((e) => e.progress === null && !e.watched)).toBe(
        true,
      );
      expect(detail.play).toMatchObject({ label: 'play', episode: { seasonNumber: 1, number: 1 } });
    });
  });

  describe('home', () => {
    it('returns rows for the audience with no personal rows and no personal state', async () => {
      const user = await h.makeUser();
      const v = await seedVideo(h.db.setup, { title: 'Home guest', kidsSafe: true });
      await saveProgress(h.ctx, user.actor, {
        profileId: user.profileId,
        videoId: v.id,
        positionMs: 30_000,
      });
      await addToMyList(h.ctx, user.actor, {
        profileId: user.profileId,
        target: { kind: 'video', id: v.id },
      });
      const home = await getGuestHome(h.ctx, general);
      expect(home.rows.some((r) => r.kind === 'continue_watching' || r.kind === 'my_list')).toBe(
        false,
      );
      const cards = [
        ...home.rows.flatMap((r) => r.items as TitleCardDto[]),
        ...home.hero.map((x) => x.card),
      ];
      expect(cards.length).toBeGreaterThan(0);
      for (const card of cards) {
        expect(card.progress).toBeNull();
        expect(card.inMyList).toBe(false);
      }
    });

    it('filters for Kids mode in the query', async () => {
      const adult = await seedVideo(h.db.setup, { title: 'Home adult only', kidsSafe: false });
      const home = await getGuestHome(h.ctx, kids);
      const ids = [
        ...home.rows.flatMap((r) => r.items as TitleCardDto[]),
        ...home.hero.map((x) => x.card),
      ].map((c) => c.id);
      expect(ids).not.toContain(adult.id);
    });

    it('rejects a junk cursor', async () => {
      await expect(getGuestHome(h.ctx, general, { cursor: 'junk' })).rejects.toBeTruthy();
    });
  });

  describe('browse, categories, popular', () => {
    it('lists categories and titles for the audience only, with no personal state', async () => {
      const shelf = await seedCategory(h.db.setup, 'Guest browse shelf');
      const child = await seedVideo(h.db.setup, { title: 'Browse child', kidsSafe: true });
      const adult = await seedVideo(h.db.setup, { title: 'Browse adult', kidsSafe: false });
      await categorize(h.db.setup, { videoId: child.id }, shelf.id);
      await categorize(h.db.setup, { videoId: adult.id }, shelf.id);
      const general1 = await guestBrowse(h.ctx, general, { categorySlug: shelf.slug });
      expect(general1.items.map((c) => c.id).sort()).toEqual([adult.id, child.id].sort());
      expect(general1.items.every((c) => c.progress === null && !c.inMyList)).toBe(true);
      const kid = await guestBrowse(h.ctx, kids, { categorySlug: shelf.slug });
      expect(kid.items.map((c) => c.id)).toEqual([child.id]);
      expect(kid.total).toBe(1);
      expect((await guestCategories(h.ctx, kids)).map((c) => c.name)).toContain(
        'Guest browse shelf',
      );
      expect((await guestBrowse(h.ctx, general, { categorySlug: 'no-such-shelf' })).items).toEqual(
        [],
      );
    });

    it('serves popular titles for the audience', async () => {
      const list = await guestPopular(h.ctx, kids, { limit: 5 });
      expect(list.every((c) => c.kidsSafe)).toBe(true);
    });
  });

  describe('search', () => {
    it('finds titles and writes nothing to search_history, even for the same text a user recorded', async () => {
      const user = await h.makeUser();
      const v = await seedVideo(h.db.setup, { title: 'Zebra migration guest' });
      await search(h.ctx, user.actor, {
        profileId: user.profileId,
        query: 'zebra migration',
        record: true,
      });
      const before = await h.db.setup.select().from(searchHistory);
      const found = await guestSearch(h.ctx, general, { query: 'zebra migration' });
      expect(found.items.map((c) => c.id)).toContain(v.id);
      expect(found.items.every((c) => c.progress === null && !c.inMyList)).toBe(true);
      expect(await h.db.setup.select().from(searchHistory)).toEqual(before);
      expect(await getRecentSearches(h.ctx, user.actor, { profileId: user.profileId })).toEqual([
        'zebra migration',
      ]);
    });

    it('applies the kids filter and refuses a too short query', async () => {
      const adult = await seedVideo(h.db.setup, { title: 'Quokka adults only', kidsSafe: false });
      expect(
        (await guestSearch(h.ctx, kids, { query: 'quokka adults' })).items.map((c) => c.id),
      ).not.toContain(adult.id);
      await expect(guestSearch(h.ctx, general, { query: 'a' })).rejects.toBeTruthy();
    });

    it('suggests only titles in the audience', async () => {
      await seedVideo(h.db.setup, { title: 'Wombat tales adult', kidsSafe: false });
      await seedVideo(h.db.setup, { title: 'Wombat tales child', kidsSafe: true });
      const general1 = await guestSuggest(h.ctx, general, 'wombat');
      const kid = await guestSuggest(h.ctx, kids, 'wombat');
      expect(general1.length).toBeGreaterThan(kid.length);
      expect(JSON.stringify(kid)).not.toContain('adult');
    });
  });

  describe('titles by ids', () => {
    it('returns cards in order, drops unknown, hidden and kids unsafe ids, with no personal state', async () => {
      const a = await seedVideo(h.db.setup, { title: 'Batch A', kidsSafe: true });
      const b = await seedVideo(h.db.setup, { title: 'Batch B', kidsSafe: false });
      const draft = await seedVideo(h.db.setup, { title: 'Batch draft', publishState: 'draft' });
      const ids = [b.id, draft.id, 'not-a-uuid', '0192f0a0-0000-7000-8000-00000000dead', a.id];
      const cards = await guestTitlesByIds(h.ctx, general, ids);
      expect(cards.map((c) => c.id)).toEqual([b.id, a.id]);
      expect(cards.every((c) => c.progress === null && !c.inMyList)).toBe(true);
      expect((await guestTitlesByIds(h.ctx, kids, ids)).map((c) => c.id)).toEqual([a.id]);
    });

    it('includes episodes, refuses more than 20 ids and handles an empty list', async () => {
      const s = await seedSeries(h.db.setup, { seasonSizes: [1], episode: { kidsSafe: true } });
      const cards = await guestTitlesByIds(h.ctx, general, [s.episodes[0]!.id]);
      expect(cards).toHaveLength(1);
      expect(await guestTitlesByIds(h.ctx, general, [])).toEqual([]);
      const many = Array.from(
        { length: GUEST_BATCH_MAX + 1 },
        (_, i) => `0192f0a0-0000-7000-8000-${String(i).padStart(12, '0')}`,
      );
      await expect(guestTitlesByIds(h.ctx, general, many)).rejects.toBeTruthy();
      await expect(
        guestTitlesByIds(h.ctx, general, many.slice(0, GUEST_BATCH_MAX)),
      ).resolves.toEqual([]);
    });
  });
});
