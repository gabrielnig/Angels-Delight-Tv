import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { browse, listBrowseCategories } from './browse';
import { addToMyList } from './my-list';
import { saveProgress } from './progress';
import {
  clearRecentSearches,
  getRecentSearches,
  removeRecentSearch,
  search,
  suggest,
} from './search';
import {
  categorize,
  createHarness,
  NOW,
  seedCategory,
  seedVideo,
  type ViewerHarness,
} from './testing';

const later = (seconds: number) => new Date(NOW.getTime() + seconds * 1000);

describe.skipIf(!process.env.TEST_DATABASE_ADMIN_URL)('browse and search', () => {
  let h: ViewerHarness;
  let limited: ViewerHarness;

  beforeAll(async () => {
    h = await createHarness();
    limited = await createHarness({
      rateLimit: async () => ({ allowed: false, retryAfterSeconds: 30 }),
    });
  });
  afterAll(async () => {
    await h?.drop();
    await limited?.drop();
  });

  describe('browse', () => {
    it('lists a category with the profile progress and list state on each card', async () => {
      h.setNow(NOW);
      const user = await h.makeUser();
      const shelf = await seedCategory(h.db.setup, 'Browse shelf');
      const video = await seedVideo(h.db.setup, { title: 'Browse video', durationMs: 100_000 });
      await categorize(h.db.setup, { videoId: video.id }, shelf.id);
      await saveProgress(h.ctx, user.actor, {
        profileId: user.profileId,
        videoId: video.id,
        positionMs: 40_000,
      });
      await addToMyList(h.ctx, user.actor, {
        profileId: user.profileId,
        target: { kind: 'video', id: video.id },
      });

      const page = await browse(h.ctx, user.actor, {
        profileId: user.profileId,
        categorySlug: shelf.slug,
        sort: 'newest',
      });

      expect(page.category).toMatchObject({ slug: shelf.slug, name: 'Browse shelf' });
      expect(page.items).toHaveLength(1);
      expect(page.items[0]).toMatchObject({
        title: 'Browse video',
        inMyList: true,
        progress: { positionMs: 40_000 },
      });
    });

    it('shows a kids profile only kids safe titles and categories that hold some', async () => {
      h.setNow(NOW);
      const user = await h.makeUser();
      const adultShelf = await seedCategory(h.db.setup, 'Browse adult shelf');
      const kidsShelf = await seedCategory(h.db.setup, 'Browse kids shelf');
      const adult = await seedVideo(h.db.setup, { kidsSafe: false });
      const child = await seedVideo(h.db.setup, { title: 'Browse child', kidsSafe: true });
      await categorize(h.db.setup, { videoId: adult.id }, adultShelf.id);
      await categorize(h.db.setup, { videoId: child.id }, kidsShelf.id);

      const categories = await listBrowseCategories(h.ctx, user.actor, {
        profileId: user.kidsProfileId,
      });
      const direct = await browse(h.ctx, user.actor, {
        profileId: user.kidsProfileId,
        categorySlug: adultShelf.slug,
        sort: 'newest',
      });

      expect(categories.map((c) => c.slug)).toContain(kidsShelf.slug);
      expect(categories.map((c) => c.slug)).not.toContain(adultShelf.slug);
      expect(direct.items).toEqual([]);
    });

    it('answers an empty page with no category for a category that is switched off', async () => {
      h.setNow(NOW);
      const user = await h.makeUser();
      const hidden = await seedCategory(h.db.setup, 'Browse switched off', { isVisible: false });

      const page = await browse(h.ctx, user.actor, {
        profileId: user.profileId,
        categorySlug: hidden.slug,
        sort: 'newest',
      });

      expect(page).toEqual({ category: null, items: [], nextCursor: null });
    });

    it('answers not found for a profile of another account', async () => {
      const owner = await h.makeUser();
      const stranger = await h.makeUser();

      await expect(
        browse(h.ctx, stranger.actor, { profileId: owner.profileId, sort: 'newest' }),
      ).rejects.toMatchObject({ code: 'not_found' });
      await expect(
        listBrowseCategories(h.ctx, stranger.actor, { profileId: owner.profileId }),
      ).rejects.toMatchObject({ code: 'not_found' });
    });
  });

  describe('search', () => {
    it('finds titles and marks the ones already saved', async () => {
      h.setNow(NOW);
      const user = await h.makeUser();
      const video = await seedVideo(h.db.setup, { title: 'Searchable lantern lesson' });
      await addToMyList(h.ctx, user.actor, {
        profileId: user.profileId,
        target: { kind: 'video', id: video.id },
      });

      const result = await search(h.ctx, user.actor, {
        profileId: user.profileId,
        query: 'lantern',
      });

      expect(result.total).toBe(1);
      expect(result.items[0]).toMatchObject({ title: 'Searchable lantern lesson', inMyList: true });
      expect(result.popular).toEqual([]);
    });

    it('limits a kids profile to kids safe titles', async () => {
      h.setNow(NOW);
      const user = await h.makeUser();
      await seedVideo(h.db.setup, { title: 'Violin grown up', kidsSafe: false });
      await seedVideo(h.db.setup, { title: 'Violin for kids', kidsSafe: true });

      const result = await search(h.ctx, user.actor, {
        profileId: user.kidsProfileId,
        query: 'violin',
      });

      expect(result.items.map((item) => item.title)).toEqual(['Violin for kids']);
    });

    it('returns popular titles when nothing matches, kids safe ones for a kids profile', async () => {
      h.setNow(NOW);
      const user = await h.makeUser();
      await seedVideo(h.db.setup, {
        title: 'Fallback adult',
        kidsSafe: false,
        publishedAt: later(0),
      });
      await seedVideo(h.db.setup, {
        title: 'Fallback kids',
        kidsSafe: true,
        publishedAt: new Date('2026-01-01'),
      });

      const adult = await search(h.ctx, user.actor, { profileId: user.profileId, query: 'zzzqqq' });
      const kids = await search(h.ctx, user.actor, {
        profileId: user.kidsProfileId,
        query: 'zzzqqq',
      });

      expect(adult.total).toBe(0);
      expect(adult.popular.length).toBeGreaterThan(0);
      expect(kids.popular.map((item) => item.title)).not.toContain('Fallback adult');
    });

    it('rejects a query shorter than two characters', async () => {
      const user = await h.makeUser();

      await expect(
        search(h.ctx, user.actor, { profileId: user.profileId, query: ' a ' }),
      ).rejects.toMatchObject({ code: 'validation_failed', fields: { query: expect.any(Array) } });
    });

    it('limits how often a profile can search', async () => {
      const user = await limited.makeUser();

      await expect(
        search(limited.ctx, user.actor, { profileId: user.profileId, query: 'anything' }),
      ).rejects.toMatchObject({ code: 'rate_limited' });
    });

    it('answers not found for a profile of another account', async () => {
      const owner = await h.makeUser();
      const stranger = await h.makeUser();

      await expect(
        search(h.ctx, stranger.actor, { profileId: owner.profileId, query: 'lantern' }),
      ).rejects.toMatchObject({ code: 'not_found' });
      await expect(
        suggest(h.ctx, stranger.actor, { profileId: owner.profileId, query: 'lan' }),
      ).rejects.toMatchObject({ code: 'not_found' });
    });
  });

  describe('suggestions', () => {
    it('suggests titles for a prefix and respects the kids filter', async () => {
      h.setNow(NOW);
      const user = await h.makeUser();
      await seedVideo(h.db.setup, { title: 'Quokka adults', kidsSafe: false });
      await seedVideo(h.db.setup, { title: 'Quokka children', kidsSafe: true });

      const adult = await suggest(h.ctx, user.actor, { profileId: user.profileId, query: 'quok' });
      const kids = await suggest(h.ctx, user.actor, {
        profileId: user.kidsProfileId,
        query: 'quok',
      });

      expect(adult.map((s) => s.label).sort()).toEqual(['Quokka adults', 'Quokka children']);
      expect(kids.map((s) => s.label)).toEqual(['Quokka children']);
    });
  });

  describe('recent searches', () => {
    it('remembers submitted searches per profile, newest first, up to 8', async () => {
      h.setNow(NOW);
      const user = await h.makeUser();
      for (let i = 0; i < 10; i++) {
        h.setNow(later(i));
        await search(h.ctx, user.actor, {
          profileId: user.profileId,
          query: `topic ${i}`,
          record: true,
        });
      }

      const recent = await getRecentSearches(h.ctx, user.actor, { profileId: user.profileId });

      expect(recent).toHaveLength(8);
      expect(recent[0]).toBe('topic 9');
    });

    it('moves a repeated search to the top instead of duplicating it', async () => {
      h.setNow(NOW);
      const user = await h.makeUser();
      for (const [index, query] of ['alpha', 'beta', 'Alpha'].entries()) {
        h.setNow(later(index));
        await search(h.ctx, user.actor, { profileId: user.profileId, query, record: true });
      }

      expect(await getRecentSearches(h.ctx, user.actor, { profileId: user.profileId })).toEqual([
        'alpha',
        'beta',
      ]);
    });

    it('does not record without the submit flag and never records for a kids profile', async () => {
      h.setNow(NOW);
      const user = await h.makeUser();
      await search(h.ctx, user.actor, { profileId: user.profileId, query: 'typing along' });
      await search(h.ctx, user.actor, {
        profileId: user.kidsProfileId,
        query: 'kids query',
        record: true,
      });

      expect(await getRecentSearches(h.ctx, user.actor, { profileId: user.profileId })).toEqual([]);
      expect(await getRecentSearches(h.ctx, user.actor, { profileId: user.kidsProfileId })).toEqual(
        [],
      );
    });

    it('keeps the history of each profile separate', async () => {
      h.setNow(NOW);
      const user = await h.makeUser();
      await search(h.ctx, user.actor, {
        profileId: user.profileId,
        query: 'private topic',
        record: true,
      });

      const other = await h.makeUser();
      expect(await getRecentSearches(h.ctx, other.actor, { profileId: other.profileId })).toEqual(
        [],
      );
      await expect(
        getRecentSearches(h.ctx, other.actor, { profileId: user.profileId }),
      ).rejects.toMatchObject({ code: 'not_found' });
    });

    it('removes one search and clears them all', async () => {
      h.setNow(NOW);
      const user = await h.makeUser();
      for (const [index, query] of ['one', 'two', 'three'].entries()) {
        h.setNow(later(index));
        await search(h.ctx, user.actor, {
          profileId: user.profileId,
          query: `${query} term`,
          record: true,
        });
      }

      await removeRecentSearch(h.ctx, user.actor, { profileId: user.profileId, query: 'two term' });
      expect(await getRecentSearches(h.ctx, user.actor, { profileId: user.profileId })).toEqual([
        'three term',
        'one term',
      ]);

      await clearRecentSearches(h.ctx, user.actor, { profileId: user.profileId });
      expect(await getRecentSearches(h.ctx, user.actor, { profileId: user.profileId })).toEqual([]);
    });
  });
});
