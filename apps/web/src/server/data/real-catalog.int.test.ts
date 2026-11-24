import { seedDemo } from '@ad/catalog';
import { searchHistory, slugRedirects, videos, watchProgress } from '@ad/db';
import {
  categorize,
  createHarness,
  integrationEnabled,
  NOW,
  seedAsset,
  seedCategory,
  seedSeries,
  seedVideo,
  type ViewerHarness,
} from '@ad/viewer/testing';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { guestContext, type ViewerContext } from '../../lib/data/types';
import { RealCatalog } from './real-catalog';

type User = Awaited<ReturnType<ViewerHarness['makeUser']>>;
const adultCtx = (u: User): ViewerContext => ({
  accountId: u.accountId,
  profileId: u.profileId,
  audience: 'adult',
});
const kidsCtx = (u: User): ViewerContext => ({
  accountId: u.accountId,
  profileId: u.kidsProfileId,
  audience: 'kids',
});

describe.skipIf(!integrationEnabled())('real catalog repository', () => {
  let h: ViewerHarness;
  let catalog: RealCatalog;
  let user: User;

  beforeAll(async () => {
    h = await createHarness();
    catalog = new RealCatalog(h.ctx);
    user = await h.makeUser();
    await seedDemo(h.db.setup, NOW);
  });
  afterAll(async () => {
    await h?.drop();
  });

  async function seriesDetail(ctx: ViewerContext, slug: string) {
    const result = await catalog.series(ctx, slug);
    if (result && 'redirect' in result) throw new Error('unexpected redirect');
    return result;
  }

  describe('home', () => {
    it('returns a hero, catalog rows with see all links, and no personal rows', async () => {
      const home = await catalog.home(adultCtx(user));
      expect(home.empty).toBe(false);
      expect(home.hero.length).toBeGreaterThan(0);
      expect(home.rows.length).toBeGreaterThan(0);
      for (const row of home.rows) {
        expect(row.items.length).toBeGreaterThan(0);
        expect(['Continue Watching', 'Continue learning', 'My List']).not.toContain(row.title);
      }
      expect(new Set(home.rows.map((r) => r.id)).size).toBe(home.rows.length);
    });

    it('pages the rows below the first screen by cursor without repeating any', async () => {
      const first = await catalog.home(adultCtx(user));
      const ids = first.rows.map((r) => r.id);
      let cursor = first.nextCursor ?? null;
      let guard = 0;
      while (cursor && guard++ < 10) {
        const page = await catalog.homeRows(adultCtx(user), cursor);
        for (const row of page.rows) {
          expect(ids).not.toContain(row.id);
          ids.push(row.id);
        }
        cursor = page.nextCursor;
      }
      expect(cursor).toBeNull();
      expect(new Set(ids).size).toBe(ids.length);
    });

    it('only shows kids safe titles on a kids profile', async () => {
      const home = await catalog.home(kidsCtx(user));
      const items = [...home.hero.map((s) => s.item), ...home.rows.flatMap((r) => r.items)];
      expect(items.length).toBeGreaterThan(0);
      expect(items.every((i) => i.kidsSafe)).toBe(true);
    });

    it('is empty when nothing is published', async () => {
      const empty = await createHarness();
      try {
        const u = await empty.makeUser();
        const home = await new RealCatalog(empty.ctx).home(adultCtx(u));
        expect(home).toEqual({ hero: [], rows: [], empty: true });
      } finally {
        await empty.drop();
      }
    });

    it('ignores the audience the caller claims and uses the stored profile', async () => {
      const lying = { ...kidsCtx(user), audience: 'adult' as const };
      const home = await catalog.home(lying);
      const items = [...home.hero.map((s) => s.item), ...home.rows.flatMap((r) => r.items)];
      expect(items.every((i) => i.kidsSafe)).toBe(true);
    });
  });

  describe('browse', () => {
    it('lists categories that hold titles', async () => {
      const cats = await catalog.categories(adultCtx(user));
      expect(cats.length).toBe(5);
      expect(cats[0]).toEqual(
        expect.objectContaining({ slug: expect.any(String), name: expect.any(String) }),
      );
    });

    it('pages with a cursor and reports the total', async () => {
      const first = await catalog.browse(adultCtx(user), { limit: 10 });
      expect(first.items).toHaveLength(10);
      expect(first.total).toBe(33);
      expect(first.nextCursor).not.toBeNull();
      const second = await catalog.browse(adultCtx(user), { limit: 10, cursor: first.nextCursor! });
      const ids = new Set([...first.items, ...second.items].map((i) => `${i.kind}:${i.slug}`));
      expect(ids.size).toBe(20);
    });

    it('filters by category, length and sort', async () => {
      const cats = await catalog.categories(adultCtx(user));
      const inCat = await catalog.browse(adultCtx(user), {
        categorySlug: cats[0]!.slug,
        limit: 50,
      });
      expect(inCat.total).toBe(inCat.items.length);
      const short = await catalog.browse(adultCtx(user), {
        length: 'short',
        sort: 'longest',
        limit: 50,
      });
      const durations = short.items.map((i) => (i.kind === 'video' ? i.durationSeconds : 0));
      expect(durations.every((d) => d < 180)).toBe(true);
      expect([...durations].sort((a, b) => b - a)).toEqual(durations);
    });

    it('returns an empty page for an unknown category', async () => {
      const page = await catalog.browse(adultCtx(user), { categorySlug: 'nope' });
      expect(page).toEqual({ items: [], total: 0, nextCursor: null });
    });

    it('filters for kids', async () => {
      const page = await catalog.browse(kidsCtx(user), { limit: 50 });
      expect(page.items.every((i) => i.kidsSafe)).toBe(true);
      expect(page.total).toBe(page.items.length);
    });
  });

  describe('search and suggestions', () => {
    it('finds a title and reports the total', async () => {
      const one = (await catalog.browse(adultCtx(user), { limit: 1 })).items[0]!;
      const word = one.title.split(/\s+/).find((w) => w.length > 3)!;
      const page = await catalog.search(adultCtx(user), word);
      expect(page.total).toBeGreaterThan(0);
      expect(page.items.some((i) => i.slug === one.slug)).toBe(true);
    });

    it('answers an empty page for a query that is too short', async () => {
      expect(await catalog.search(adultCtx(user), 'a')).toEqual({
        items: [],
        total: 0,
        nextCursor: null,
      });
    });

    it('suggests titles with links', async () => {
      const t = await seedVideo(h.db.setup, {
        title: 'Zebra stripes explained',
        slug: 'zebra-stripes',
      });
      const s = await seedSeries(h.db.setup, {
        series: { title: 'Zebra island', slug: 'zebra-island' },
      });
      const found = await catalog.suggest(adultCtx(user), 'zebra');
      expect(found).toEqual(
        expect.arrayContaining([
          { type: 'video', label: 'Zebra stripes explained', href: `/title/${t.slug}` },
          { type: 'video', label: 'Zebra island', href: `/series/${s.slug}` },
        ]),
      );
      expect(await catalog.suggest(adultCtx(user), 'z')).toEqual([]);
    });

    it('offers popular titles for the no results screen', async () => {
      const popular = await catalog.popular(adultCtx(user));
      expect(popular.length).toBeGreaterThan(0);
      expect(popular.every((i) => i.kind === 'video')).toBe(true);
    });
  });

  describe('title detail', () => {
    it('maps a video with category, related titles and saved progress', async () => {
      const cat = await seedCategory(h.db.setup, 'Detail Cat');
      const video = await seedVideo(h.db.setup, {
        title: 'Detail video',
        slug: 'detail-video',
        description: 'About rivers',
        durationMs: 600_000,
        kidsSafe: true,
      });
      const sibling = await seedVideo(h.db.setup, { title: 'Sibling video', kidsSafe: true });
      await categorize(h.db.setup, { videoId: video.id }, cat.id);
      await categorize(h.db.setup, { videoId: sibling.id }, cat.id);
      await h.db.setup.insert(watchProgress).values({
        profileId: user.profileId,
        videoId: video.id,
        positionMs: 120_000,
        durationMs: 600_000,
        completed: false,
        updatedAt: NOW,
      });

      const detail = await catalog.title(adultCtx(user), 'detail-video');
      if (!detail || 'blocked' in detail || 'redirect' in detail)
        throw new Error('expected detail');
      expect(detail.video).toMatchObject({
        id: video.id,
        title: 'Detail video',
        categoryName: 'Detail Cat',
        categorySlug: cat.slug,
        durationSeconds: 600,
      });
      expect(detail.longDescription).toBe('About rivers');
      expect(detail.related.map((r) => r.title)).toContain('Sibling video');
      expect(detail.progress).toMatchObject({
        videoId: video.id,
        positionSeconds: 120,
        durationSeconds: 600,
      });
      expect(detail.play).toEqual({ label: 'resume', startSeconds: 117 });
    });

    it('offers Watch again for a finished video and Play for one nobody started', async () => {
      const done = await seedVideo(h.db.setup, {
        title: 'Finished one',
        slug: 'finished-one',
        durationMs: 600_000,
        kidsSafe: true,
      });
      const fresh = await seedVideo(h.db.setup, {
        title: 'Fresh one',
        slug: 'fresh-one',
        durationMs: 600_000,
        kidsSafe: true,
      });
      await h.db.setup.insert(watchProgress).values({
        profileId: user.profileId,
        videoId: done.id,
        positionMs: 0,
        durationMs: 600_000,
        completed: true,
        updatedAt: NOW,
      });
      const finished = await catalog.title(adultCtx(user), 'finished-one');
      const untouched = await catalog.title(adultCtx(user), 'fresh-one');
      if (!finished || 'blocked' in finished || 'redirect' in finished) throw new Error('detail');
      if (!untouched || 'blocked' in untouched || 'redirect' in untouched)
        throw new Error('detail');
      expect(finished.play).toEqual({ label: 'watch_again', startSeconds: 0 });
      expect(untouched.play).toEqual({ label: 'play', startSeconds: 0 });
      expect(fresh.id).not.toBe(done.id);
    });

    it('is null for unknown or hidden titles, never leaking that they exist', async () => {
      expect(await catalog.title(adultCtx(user), 'no-such-title')).toBeNull();
      const adultsOnly = await seedVideo(h.db.setup, { slug: 'adults-only', kidsSafe: false });
      expect(adultsOnly.slug).toBe('adults-only');
      expect(await catalog.title(adultCtx(user), 'adults-only')).not.toBeNull();
      expect(await catalog.title(kidsCtx(user), 'adults-only')).toBeNull();
    });

    it('points an episode slug to its series', async () => {
      const s = await seedSeries(h.db.setup, {
        series: { title: 'Redirect series', slug: 'redirect-series' },
      });
      const [episodeVideo] = await h.db.setup
        .select()
        .from(videos)
        .where(eq(videos.id, s.episodes[0]!.id));
      const result = await catalog.title(adultCtx(user), episodeVideo!.slug);
      expect(result).toEqual({ redirect: '/series/redirect-series' });
    });
  });

  describe('series detail', () => {
    it('lists seasons and episodes and resumes the one in progress', async () => {
      const s = await seedSeries(h.db.setup, {
        series: { title: 'Series with progress', slug: 'series-with-progress', kidsSafe: true },
        seasonSizes: [2, 1],
        episode: { kidsSafe: true, durationMs: 300_000 },
      });
      const second = s.episodes.find((e) => e.season === 1 && e.number === 2)!;
      await h.db.setup.insert(watchProgress).values({
        profileId: user.profileId,
        videoId: second.id,
        positionMs: 100_000,
        durationMs: 300_000,
        completed: false,
        updatedAt: NOW,
      });
      const detail = await seriesDetail(adultCtx(user), 'series-with-progress');
      expect(detail).not.toBeNull();
      expect(detail!.series).toMatchObject({
        kind: 'series',
        slug: 'series-with-progress',
        episodeCount: 3,
        seasonCount: 2,
      });
      expect(detail!.seasons.map((x) => [x.number, x.episodes.length])).toEqual([
        [1, 2],
        [2, 1],
      ]);
      expect(detail!.seasons[0]!.episodes[1]).toMatchObject({
        number: 2,
        video: { id: second.id, series: { slug: 'series-with-progress', season: 1, episode: 2 } },
        progress: { positionSeconds: 100 },
        watched: false,
      });
      expect(detail!.next).toMatchObject({
        videoId: second.id,
        season: 1,
        episode: 2,
        resume: true,
        secondsLeft: 200,
        label: 'resume',
      });
      expect(detail!.seasons[0]!.episodes.map((e) => e.current)).toEqual([false, true]);
      expect(detail!.seasons[1]!.episodes.map((e) => e.current)).toEqual([false]);
    });

    it('starts at the first episode when nothing was watched, and hides it from kids when unsafe', async () => {
      const s = await seedSeries(h.db.setup, {
        series: { slug: 'fresh-series', title: 'Fresh', kidsSafe: false },
        seasonSizes: [2],
      });
      const detail = await seriesDetail(adultCtx(user), 'fresh-series');
      expect(detail!.next).toMatchObject({
        videoId: s.episodes[0]!.id,
        season: 1,
        episode: 1,
        resume: false,
      });
      expect(await seriesDetail(kidsCtx(user), 'fresh-series')).toBeNull();
      expect(await seriesDetail(adultCtx(user), 'missing')).toBeNull();
    });

    it('does not treat a standalone video slug as a series', async () => {
      await seedVideo(h.db.setup, { slug: 'just-a-video' });
      expect(await seriesDetail(adultCtx(user), 'just-a-video')).toBeNull();
    });
  });

  describe('public preview', () => {
    it('shows published titles without a session and nothing else', async () => {
      await seedVideo(h.db.setup, { slug: 'public-one', title: 'Public one' });
      await seedVideo(h.db.setup, { slug: 'draft-one', publishState: 'draft', publishedAt: null });
      expect(await catalog.publicTitle('public-one')).toMatchObject({ title: 'Public one' });
      expect(await catalog.publicTitle('draft-one')).toBeNull();
      expect(await catalog.publicTitle('absent')).toBeNull();
    });

    it('answers an old address with a redirect to the new one, for videos and series (M04-S02)', async () => {
      const v = await seedVideo(h.db.setup, { slug: 'moved-video' });
      await h.db.setup.insert(slugRedirects).values({ oldSlug: 'was-video', videoId: v.id });
      expect(await catalog.publicPreview('was-video', 'video')).toEqual({
        type: 'redirect',
        to: '/title/moved-video',
      });
      const s = await seedSeries(h.db.setup, {
        series: { slug: 'moved-series' },
        seasonSizes: [1],
      });
      await h.db.setup.insert(slugRedirects).values({ oldSlug: 'was-series', seriesId: s.id });
      expect(await catalog.publicPreview('was-series', 'series')).toEqual({
        type: 'redirect',
        to: '/series/moved-series',
      });
    });

    it('previews a published series with its season and episode counts, and hides a draft one', async () => {
      await seedSeries(h.db.setup, {
        series: { slug: 'open-series', title: 'Open series' },
        seasonSizes: [2, 1],
      });
      await seedSeries(h.db.setup, {
        series: { slug: 'closed-series', publishState: 'draft', publishedAt: null },
        seasonSizes: [1],
      });
      const open = await catalog.publicPreview('open-series', 'series');
      expect(open).toMatchObject({
        type: 'series',
        item: { kind: 'series', title: 'Open series', episodeCount: 3 },
      });
      expect(await catalog.publicPreview('closed-series', 'series')).toBeNull();
      expect(await catalog.publicPreview('open-series', 'video')).toBeNull();
    });

    it('sends an episode address to its series', async () => {
      const s = await seedSeries(h.db.setup, { series: { slug: 'ep-series' }, seasonSizes: [1] });
      const episode = s.episodes[0]!;
      const row = await h.db.setup
        .select({ slug: videos.slug })
        .from(videos)
        .where(eq(videos.id, episode.id));
      expect(await catalog.publicPreview(row[0]!.slug, 'video')).toEqual({
        type: 'redirect',
        to: '/series/ep-series',
      });
    });

    it('carries artwork when the title has a poster', async () => {
      const assetId = await seedAsset(h.db.setup);
      await seedVideo(h.db.setup, { slug: 'with-poster', posterAssetId: assetId });
      const item = await catalog.publicTitle('with-poster');
      expect(item?.thumbnail?.src).toMatch(/^https:\/\/media\.test\/img\/.+640/);
    });
  });

  describe('guest branch (M40-S01)', () => {
    const general = () => guestContext('adult');
    const kids = () => guestContext('kids');

    it('builds the guest context with no account and no profile', () => {
      expect(general()).toEqual({
        accountId: '',
        profileId: 'none',
        audience: 'adult',
        guest: true,
      });
      expect(kids().audience).toBe('kids');
    });

    it('serves home rows and the hero with no personal rows, and pages further rows', async () => {
      const home = await catalog.home(general());
      expect(home.empty).toBe(false);
      expect(home.hero.length).toBeGreaterThan(0);
      expect(home.rows.length).toBeGreaterThan(0);
      const titles = [...home.hero.map((h) => h.item), ...home.rows.flatMap((r) => r.items)];
      expect(titles.length).toBeGreaterThan(0);
      if (home.nextCursor) {
        const more = await catalog.homeRows(general(), home.nextCursor);
        expect(more.rows.length).toBeGreaterThan(0);
      }
    });

    it('lists categories and browses for the audience, with kids filtered in the query', async () => {
      const cats = await catalog.categories(general());
      expect(cats.length).toBeGreaterThan(0);
      const all = await catalog.browse(general(), { sort: 'newest' });
      const kid = await catalog.browse(kids(), { sort: 'newest' });
      expect(all.total).toBeGreaterThanOrEqual(kid.total);
      expect(kid.items.every((i) => i.kidsSafe)).toBe(true);
    });

    it('searches without writing history and suggests', async () => {
      const before = await h.db.setup.select().from(searchHistory);
      const found = await catalog.search(general(), 'rain');
      expect(found.items.length).toBeGreaterThanOrEqual(0);
      expect(await h.db.setup.select().from(searchHistory)).toEqual(before);
      expect(Array.isArray(await catalog.suggest(general(), 'rain'))).toBe(true);
      expect(await catalog.search(general(), 'a')).toEqual({
        items: [],
        total: 0,
        nextCursor: null,
      });
    });

    it('shows popular videos', async () => {
      expect((await catalog.popular(kids())).every((v) => v.kidsSafe)).toBe(true);
    });

    it('opens a title and a series for a guest with no personal state and a plain Play', async () => {
      const video = await seedVideo(h.db.setup, { title: 'Guest title page', kidsSafe: true });
      const result = await catalog.title(general(), video.slug);
      expect(result && 'video' in result ? result.video.title : null).toBe('Guest title page');
      expect(result && 'play' in result ? result.play.label : null).toBe('play');
      const s = await seedSeries(h.db.setup, { seasonSizes: [2], episode: { kidsSafe: true } });
      const series = await catalog.series(general(), s.slug);
      expect(series && 'seasons' in series ? series.next.label : null).toBe('play');
      expect(
        series && 'seasons' in series ? series.seasons[0]!.episodes.every((e) => !e.watched) : null,
      ).toBe(true);
    });

    it('says an adult title is not in Kids mode, and a missing one is still not found', async () => {
      const adultOnly = await seedVideo(h.db.setup, { title: 'Guest adult page', kidsSafe: false });
      expect(await catalog.title(kids(), adultOnly.slug)).toEqual({ blocked: 'kids' });
      expect(await catalog.title(kids(), 'no-such-title')).toBeNull();
      expect(await catalog.title(general(), adultOnly.slug)).not.toBeNull();
    });

    it('ignores personal state the same title has for a signed in viewer', async () => {
      const video = await seedVideo(h.db.setup, { title: 'Guest vs account', durationMs: 200_000 });
      await h.db.setup.insert(watchProgress).values({
        profileId: user.profileId,
        videoId: video.id,
        positionMs: 90_000,
        durationMs: 200_000,
        completed: false,
      } as never);
      const asUser = await catalog.title(adultCtx(user), video.slug);
      const asGuest = await catalog.title(general(), video.slug);
      expect(asUser && 'progress' in asUser ? asUser.progress : null).toBeTruthy();
      expect(asGuest && 'progress' in asGuest ? asGuest.progress : null).toBeFalsy();
    });
  });
});
