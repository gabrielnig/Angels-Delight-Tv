import { sql } from 'drizzle-orm';
import { rows, rowItems, videoDailyStats } from '@ad/db';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { getHome, type HomeRowDto } from './home';
import { addToMyList } from './my-list';
import { saveProgress } from './progress';
import {
  categorize,
  createHarness,
  NOW,
  seedAsset,
  seedCategory,
  seedSeries,
  seedVideo,
  type ViewerHarness,
} from './testing';

const later = (seconds: number) => new Date(NOW.getTime() + seconds * 1000);

describe.skipIf(!process.env.TEST_DATABASE_ADMIN_URL)('home', () => {
  let h: ViewerHarness;
  let position = 0;

  beforeAll(async () => {
    h = await createHarness();
  });
  afterAll(async () => {
    await h?.drop();
  });

  /** Each test works on a clean catalog. Rows and titles from earlier tests are cleared first. */
  async function fresh() {
    h.setNow(NOW);
    await h.db.setup.execute(
      sql.raw(
        'TRUNCATE row_items, rows, video_daily_stats, watch_progress, my_list, video_categories, series_categories, categories, episodes, seasons, series, videos, assets CASCADE',
      ),
    );
    position = 0;
    return h.makeUser();
  }

  async function addRow(
    values: Partial<typeof rows.$inferInsert> & { title: string },
    items: ({ videoId: string } | { seriesId: string })[] = [],
  ) {
    const [row] = await h.db.setup
      .insert(rows)
      .values({
        kind: 'curated',
        isPublished: true,
        kidsVisible: false,
        position: position++,
        ...values,
      })
      .returning();
    if (items.length > 0) {
      await h.db.setup
        .insert(rowItems)
        .values(items.map((item, index) => ({ rowId: row!.id, position: index, ...item })));
    }
    return row!;
  }

  const rowTitles = (rowList: HomeRowDto[]) => rowList.map((row) => row.title);
  const itemTitles = (row: HomeRowDto | undefined) =>
    row?.kind === 'continue_watching'
      ? row.items.map((item) => item.video.title)
      : (row?.items.map((item) => item.title) ?? []);

  describe('empty catalog', () => {
    it('says the catalog is empty and returns no rows', async () => {
      const user = await fresh();

      const home = await getHome(h.ctx, user.actor, { profileId: user.profileId });

      expect(home).toMatchObject({ catalogEmpty: true, hero: [], rows: [], nextCursor: null });
    });
  });

  describe('hero', () => {
    it('lists the live titles of the hero row in order with hero artwork', async () => {
      const user = await fresh();
      const art = await seedAsset(h.db.setup, { purpose: 'hero' });
      const first = await seedVideo(h.db.setup, { title: 'Hero one', heroAssetId: art });
      const second = await seedVideo(h.db.setup, { title: 'Hero two' });
      const hidden = await seedVideo(h.db.setup, { title: 'Hero draft', publishState: 'draft' });
      await addRow({ title: 'Banner', kind: 'hero' }, [
        { videoId: second.id },
        { videoId: hidden.id },
        { videoId: first.id },
      ]);

      const home = await getHome(h.ctx, user.actor, { profileId: user.profileId });

      expect(home.hero.map((item) => item.card.title)).toEqual(['Hero two', 'Hero one']);
      expect(home.hero[1]?.heroImage?.id).toBe(art);
      expect(home.hero[0]?.play).toMatchObject({ videoId: second.id, label: 'play', startMs: 0 });
      expect(home.rows).toEqual([]);
    });

    it('falls back to the newest titles when no hero is configured', async () => {
      const user = await fresh();
      await seedVideo(h.db.setup, { title: 'Older', publishedAt: new Date('2026-01-01') });
      await seedVideo(h.db.setup, { title: 'Newest', publishedAt: new Date('2026-05-01') });

      const home = await getHome(h.ctx, user.actor, { profileId: user.profileId });

      expect(home.hero.map((item) => item.card.title)).toEqual(['Newest', 'Older']);
      expect(home.catalogEmpty).toBe(false);
    });

    it('takes the fallback count from the viewer rules', async () => {
      const user = await fresh();
      for (let day = 1; day <= 4; day++) {
        await seedVideo(h.db.setup, { title: `T${day}`, publishedAt: new Date(`2026-05-0${day}`) });
      }
      const limited = { ...h.ctx, rules: { heroFallbackCount: 2 } };

      const home = await getHome(limited, user.actor, { profileId: user.profileId });

      expect(home.hero.map((item) => item.card.title)).toEqual(['T4', 'T3']);
    });

    it('plays the next unwatched episode for a series hero', async () => {
      const user = await fresh();
      const series = await seedSeries(h.db.setup, {
        series: { title: 'Hero series' },
        seasonSizes: [3],
        episode: { durationMs: 100_000 },
      });
      await addRow({ title: 'Banner', kind: 'hero' }, [{ seriesId: series.id }]);
      await saveProgress(h.ctx, user.actor, {
        profileId: user.profileId,
        videoId: series.episodes[0]!.id,
        positionMs: 99_000,
      });

      const home = await getHome(h.ctx, user.actor, { profileId: user.profileId });

      expect(home.hero[0]?.play).toMatchObject({
        videoId: series.episodes[1]!.id,
        label: 'play',
        episode: { seasonNumber: 1, number: 2 },
      });
    });
  });

  describe('rows', () => {
    it('shows a curated row in item order and drops titles that are not live', async () => {
      const user = await fresh();
      const a = await seedVideo(h.db.setup, { title: 'Row A' });
      const b = await seedVideo(h.db.setup, { title: 'Row B' });
      const draft = await seedVideo(h.db.setup, { title: 'Row draft', publishState: 'draft' });
      await addRow({ title: 'Start here' }, [
        { videoId: b.id },
        { videoId: draft.id },
        { videoId: a.id },
      ]);

      const home = await getHome(h.ctx, user.actor, { profileId: user.profileId });

      expect(rowTitles(home.rows)).toEqual(['Start here']);
      expect(itemTitles(home.rows[0])).toEqual(['Row B', 'Row A']);
    });

    it('omits rows that are unpublished or have no live items', async () => {
      const user = await fresh();
      const live = await seedVideo(h.db.setup);
      const draft = await seedVideo(h.db.setup, { publishState: 'draft' });
      await addRow({ title: 'Unpublished row', isPublished: false }, [{ videoId: live.id }]);
      await addRow({ title: 'Empty after filter' }, [{ videoId: draft.id }]);
      await addRow({ title: 'Shown' }, [{ videoId: live.id }]);

      const home = await getHome(h.ctx, user.actor, { profileId: user.profileId });

      expect(rowTitles(home.rows)).toEqual(['Shown']);
    });

    it('computes recently added, category and popular rows', async () => {
      const user = await fresh();
      const shelf = await seedCategory(h.db.setup, 'Health');
      const old = await seedVideo(h.db.setup, {
        title: 'Old one',
        publishedAt: new Date('2026-01-01'),
      });
      const fresher = await seedVideo(h.db.setup, {
        title: 'New one',
        publishedAt: new Date('2026-05-01'),
      });
      await categorize(h.db.setup, { videoId: old.id }, shelf.id);
      await h.db.setup
        .insert(videoDailyStats)
        .values({ videoId: old.id, day: '2026-06-10', views: 50 });
      await addRow({ title: 'Just in', kind: 'recently_added' });
      await addRow({ title: 'Health talks', kind: 'category', categoryId: shelf.id });
      await addRow({ title: 'Most watched', kind: 'popular' });

      const home = await getHome(h.ctx, user.actor, { profileId: user.profileId });

      expect(itemTitles(home.rows[0])).toEqual(['New one', 'Old one']);
      expect(itemTitles(home.rows[1])).toEqual(['Old one']);
      expect(itemTitles(home.rows[2])).toEqual(['Old one']);
      expect(fresher.id).toBeDefined();
    });

    it('pages rows by cursor so below the fold rows load later', async () => {
      const user = await fresh();
      const video = await seedVideo(h.db.setup);
      for (let i = 1; i <= 5; i++) await addRow({ title: `Row ${i}` }, [{ videoId: video.id }]);

      const first = await getHome(h.ctx, user.actor, { profileId: user.profileId });
      const second = await getHome(h.ctx, user.actor, {
        profileId: user.profileId,
        cursor: first.nextCursor!,
      });

      expect(rowTitles(first.rows)).toEqual(['Row 1', 'Row 2', 'Row 3']);
      expect(rowTitles(second.rows)).toEqual(['Row 4', 'Row 5']);
      expect(second.hero).toEqual([]);
      expect(second.nextCursor).toBeNull();
    });
  });

  describe('personal rows', () => {
    it('puts Continue Watching and My List first, hidden while empty', async () => {
      const user = await fresh();
      const watched = await seedVideo(h.db.setup, { title: 'Half watched', durationMs: 100_000 });
      const saved = await seedVideo(h.db.setup, { title: 'Saved for later' });
      const curated = await seedVideo(h.db.setup, { title: 'Curated pick' });
      await addRow({ title: 'Picks' }, [{ videoId: curated.id }]);

      const before = await getHome(h.ctx, user.actor, { profileId: user.profileId });
      expect(rowTitles(before.rows)).toEqual(['Picks']);

      await saveProgress(h.ctx, user.actor, {
        profileId: user.profileId,
        videoId: watched.id,
        positionMs: 40_000,
      });
      await addToMyList(h.ctx, user.actor, {
        profileId: user.profileId,
        target: { kind: 'video', id: saved.id },
      });
      const after = await getHome(h.ctx, user.actor, { profileId: user.profileId });

      expect(after.rows.map((row) => row.kind)).toEqual([
        'continue_watching',
        'my_list',
        'curated',
      ]);
      expect(itemTitles(after.rows[0])).toEqual(['Half watched']);
      expect(itemTitles(after.rows[1])).toEqual(['Saved for later']);
    });

    it('follows the order the editor configured for a personal row', async () => {
      const user = await fresh();
      const saved = await seedVideo(h.db.setup, { title: 'Saved one' });
      const curated = await seedVideo(h.db.setup, { title: 'Curated one' });
      await addRow({ title: 'Picks' }, [{ videoId: curated.id }]);
      await addRow({ title: 'My saved titles', kind: 'my_list' });
      await addToMyList(h.ctx, user.actor, {
        profileId: user.profileId,
        target: { kind: 'video', id: saved.id },
      });

      const home = await getHome(h.ctx, user.actor, { profileId: user.profileId });

      expect(rowTitles(home.rows)).toEqual(['Picks', 'My saved titles']);
    });

    it('offers See all when the list is longer than the row', async () => {
      const user = await fresh();
      for (let i = 0; i < 22; i++) {
        const video = await seedVideo(h.db.setup, { title: `Saved ${i}` });
        h.setNow(later(i));
        await addToMyList(h.ctx, user.actor, {
          profileId: user.profileId,
          target: { kind: 'video', id: video.id },
        });
      }

      const home = await getHome(h.ctx, user.actor, { profileId: user.profileId });

      const row = home.rows.find((r) => r.kind === 'my_list');
      expect(row?.items).toHaveLength(20);
      expect(row).toMatchObject({ seeAll: { type: 'my_list' } });
    });

    it('starts a new profile with no personal rows', async () => {
      const user = await fresh();
      const video = await seedVideo(h.db.setup, { kidsSafe: true });
      await saveProgress(h.ctx, user.actor, {
        profileId: user.profileId,
        videoId: video.id,
        positionMs: 40_000,
      });

      const home = await getHome(h.ctx, user.actor, { profileId: user.kidsProfileId });

      expect(home.rows.filter((row) => row.kind === 'continue_watching')).toEqual([]);
    });
  });

  describe('kids profile', () => {
    it('shows only kids visible rows with kids safe items and a kids hero', async () => {
      const user = await fresh();
      const child = await seedVideo(h.db.setup, { title: 'For children', kidsSafe: true });
      const adult = await seedVideo(h.db.setup, { title: 'Adults only', kidsSafe: false });
      await addRow({ title: 'Banner', kind: 'hero', kidsVisible: true }, [
        { videoId: adult.id },
        { videoId: child.id },
      ]);
      await addRow({ title: 'Kids row', kidsVisible: true }, [
        { videoId: adult.id },
        { videoId: child.id },
      ]);
      await addRow({ title: 'Grown up row', kidsVisible: false }, [{ videoId: child.id }]);

      const home = await getHome(h.ctx, user.actor, { profileId: user.kidsProfileId });

      expect(home.hero.map((item) => item.card.title)).toEqual(['For children']);
      expect(rowTitles(home.rows)).toEqual(['Kids row']);
      expect(itemTitles(home.rows[0])).toEqual(['For children']);
    });

    it('reports an empty catalog when no kids safe title exists', async () => {
      const user = await fresh();
      await seedVideo(h.db.setup, { kidsSafe: false });

      const kids = await getHome(h.ctx, user.actor, { profileId: user.kidsProfileId });
      const adult = await getHome(h.ctx, user.actor, { profileId: user.profileId });

      expect(kids.catalogEmpty).toBe(true);
      expect(adult.catalogEmpty).toBe(false);
    });

    it('never falls back to a non kids hero', async () => {
      const user = await fresh();
      await seedVideo(h.db.setup, { title: 'Adult newest', kidsSafe: false });

      const home = await getHome(h.ctx, user.actor, { profileId: user.kidsProfileId });

      expect(home.hero).toEqual([]);
    });
  });

  describe('ownership', () => {
    it('answers not found for a profile of another account', async () => {
      const owner = await fresh();
      const stranger = await h.makeUser();

      await expect(
        getHome(h.ctx, stranger.actor, { profileId: owner.profileId }),
      ).rejects.toMatchObject({ code: 'not_found' });
    });

    it('rejects a cursor that was not issued by the service', async () => {
      const user = await fresh();

      await expect(
        getHome(h.ctx, user.actor, { profileId: user.profileId, cursor: 'junk' }),
      ).rejects.toMatchObject({ code: 'validation_failed' });
    });
  });
});
