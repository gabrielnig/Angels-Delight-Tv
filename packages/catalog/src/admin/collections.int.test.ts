import { eq } from 'drizzle-orm';
import { schema, videos } from '@ad/db';
import { uuidv7, type Actor } from '@ad/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  categorize,
  createViewerTestDb,
  integrationEnabled,
  seedAccount,
  seedAsset,
  seedCategory,
  seedVideo,
  type ViewerTestDb,
} from '../testing';
import {
  createAdminCategory,
  deleteAdminCategory,
  listAdminCategories,
  moveAdminCategory,
  renameAdminCategory,
  setAdminCategoryHidden,
} from './categories';
import {
  createAdminSeries,
  deleteAdminSeries,
  getAdminSeriesDetail,
  listAdminSeries,
  setAdminEpisode,
  updateAdminSeries,
} from './series';
import type { AdminContext } from './types';

describe.skipIf(!integrationEnabled())('admin categories and series', () => {
  let t: ViewerTestDb;
  let ctx: AdminContext;
  let editor: Actor;
  let viewer: Actor;

  beforeAll(async () => {
    t = await createViewerTestDb();
    ctx = { db: t.app };
    editor = { accountId: (await seedAccount(t.setup, 'editor')).id, role: 'editor' };
    viewer = { accountId: (await seedAccount(t.setup)).id, role: 'viewer' };
  });
  afterAll(async () => {
    await t?.drop();
  });

  describe('categories', () => {
    it('creates with a slug, appends at the end, and refuses a duplicate name in any case', async () => {
      expect(await createAdminCategory(ctx, editor, '  Health   and body ')).toEqual({ ok: true });
      expect(await createAdminCategory(ctx, editor, 'health and BODY')).toEqual({
        ok: false,
        error: 'A category with that name already exists.',
      });
      expect(await createAdminCategory(ctx, editor, '')).toEqual({
        ok: false,
        error: 'Give the category a name.',
      });
      expect(await createAdminCategory(ctx, editor, 'x'.repeat(41))).toEqual({
        ok: false,
        error: 'Use 40 characters or fewer.',
      });
      const list = await listAdminCategories(ctx, editor);
      expect(list.at(-1)).toMatchObject({ name: 'Health and body', hidden: false, videoCount: 0 });
    });

    it('gives names that slugify the same different slugs', async () => {
      expect(await createAdminCategory(ctx, editor, 'Maths!')).toEqual({ ok: true });
      expect(await createAdminCategory(ctx, editor, 'Maths?')).toEqual({ ok: true });
    });

    it('renames, hides and counts only live videos', async () => {
      const cat = await seedCategory(t.setup, 'Rename me');
      const live = await seedVideo(t.setup);
      const trashed = await seedVideo(t.setup, { deletedAt: new Date() });
      await categorize(t.setup, { videoId: live.id }, cat.id);
      await categorize(t.setup, { videoId: trashed.id }, cat.id);

      expect(await renameAdminCategory(ctx, editor, cat.id, 'Renamed')).toEqual({ ok: true });
      expect(await setAdminCategoryHidden(ctx, editor, cat.id, true)).toEqual({ ok: true });
      const row = (await listAdminCategories(ctx, editor)).find((c) => c.id === cat.id);
      expect(row).toMatchObject({ name: 'Renamed', hidden: true, videoCount: 1 });
      expect(await renameAdminCategory(ctx, editor, uuidv7(), 'x')).toEqual({
        ok: false,
        error: 'Category not found.',
      });
    });

    it('moves up and down by swapping, and ignores a move past either end', async () => {
      const before = (await listAdminCategories(ctx, editor)).map((c) => c.id);
      const last = before.at(-1)!;
      await moveAdminCategory(ctx, editor, last, -1);
      const after = (await listAdminCategories(ctx, editor)).map((c) => c.id);
      expect(after.at(-2)).toBe(last);
      expect(after.at(-1)).toBe(before.at(-2));
      await moveAdminCategory(ctx, editor, after[0]!, -1);
      expect((await listAdminCategories(ctx, editor)).map((c) => c.id)).toEqual(after);
      expect((await listAdminCategories(ctx, editor)).map((c) => c.position)).toEqual(
        after.map((_, i) => i),
      );
    });

    it('refuses to delete a category in use and deletes an empty one', async () => {
      const used = await seedCategory(t.setup, 'In use');
      const v = await seedVideo(t.setup);
      await categorize(t.setup, { videoId: v.id }, used.id);
      const refused = await deleteAdminCategory(ctx, editor, used.id);
      expect(refused).toEqual({
        ok: false,
        error: '1 video uses this category. Move them first, or hide the category instead.',
      });
      const empty = await seedCategory(t.setup, 'Empty one');
      expect(await deleteAdminCategory(ctx, editor, empty.id)).toEqual({ ok: true });
      expect((await listAdminCategories(ctx, editor)).some((c) => c.id === empty.id)).toBe(false);
    });

    it('refuses viewers', async () => {
      await expect(listAdminCategories(ctx, viewer)).rejects.toThrow();
      await expect(createAdminCategory(ctx, viewer, 'Nope')).rejects.toThrow();
    });
  });

  describe('series', () => {
    it('creates a draft series and validates the title', async () => {
      expect(await createAdminSeries(ctx, editor, { title: ' ', description: '' })).toEqual({
        ok: false,
        error: 'Give the series a title.',
      });
      expect(
        await createAdminSeries(ctx, editor, { title: 'a'.repeat(81), description: '' }),
      ).toEqual({
        ok: false,
        error: 'Use 80 characters or fewer.',
      });
      expect(
        await createAdminSeries(ctx, editor, { title: 'Fractions course', description: 'Learn.' }),
      ).toEqual({ ok: true });
      const row = (await listAdminSeries(ctx, editor)).find((s) => s.title === 'Fractions course');
      expect(row).toMatchObject({ description: 'Learn.', published: false, episodeCount: 0 });
    });

    it('assigns episodes into seasons, orders them, and lists unassigned videos as available', async () => {
      await createAdminSeries(ctx, editor, { title: 'Order test', description: 'Order.' });
      const series = (await listAdminSeries(ctx, editor)).find((s) => s.title === 'Order test')!;
      const a = await seedVideo(t.setup, { title: 'Second' });
      const b = await seedVideo(t.setup, { title: 'First' });

      expect(await setAdminEpisode(ctx, editor, a.id, series.id, 1, 2)).toEqual({ ok: true });
      expect(await setAdminEpisode(ctx, editor, b.id, series.id, 1, 1)).toEqual({ ok: true });
      expect(await setAdminEpisode(ctx, editor, a.id, series.id, 1, 1)).toEqual({
        ok: false,
        error: 'Season 1 already has an episode 1.',
      });

      const detail = await getAdminSeriesDetail(ctx, editor, series.id);
      expect(detail.episodes.map((e) => e.title)).toEqual(['First', 'Second']);
      expect(detail.episodes[0]).toMatchObject({ seasonNumber: 1, episodeNumber: 1 });
      expect(detail.available.some((v) => v.id === a.id)).toBe(false);
      const [row] = await t.setup.select().from(videos).where(eq(videos.id, a.id));
      expect(row?.kind).toBe('episode');

      expect(await setAdminEpisode(ctx, editor, a.id, null, null, null)).toEqual({ ok: true });
      const again = await getAdminSeriesDetail(ctx, editor, series.id);
      expect(again.episodes.map((e) => e.id)).toEqual([b.id]);
      expect(again.available.some((v) => v.id === a.id)).toBe(true);
      const [back] = await t.setup.select().from(videos).where(eq(videos.id, a.id));
      expect(back?.kind).toBe('standalone');
    });

    it('publishes only when the checklist is met, and unpublishes', async () => {
      await createAdminSeries(ctx, editor, { title: 'Publish test', description: 'Ready.' });
      const series = (await listAdminSeries(ctx, editor)).find((s) => s.title === 'Publish test')!;
      expect(await updateAdminSeries(ctx, editor, series.id, { published: true })).toEqual({
        ok: false,
        error: 'Publish at least one episode before publishing the series.',
      });
      const ep = await seedVideo(t.setup);
      await setAdminEpisode(ctx, editor, ep.id, series.id, 1, 1);
      const refused = await updateAdminSeries(ctx, editor, series.id, { published: true });
      expect(refused.ok).toBe(false);
      expect(!refused.ok && refused.error).toMatch(/Choose a poster/);

      const cat = await seedCategory(t.setup, 'For series');
      const poster = await seedAsset(t.setup);
      await t.setup
        .update(schema.series)
        .set({ posterAssetId: poster })
        .where(eq(schema.series.id, series.id));
      await t.setup
        .insert(schema.seriesCategories)
        .values({ seriesId: series.id, categoryId: cat.id });

      expect(await updateAdminSeries(ctx, editor, series.id, { published: true })).toEqual({
        ok: true,
      });
      expect((await getAdminSeriesDetail(ctx, editor, series.id)).series.published).toBe(true);
      expect(await updateAdminSeries(ctx, editor, series.id, { published: false })).toEqual({
        ok: true,
      });
      expect(
        await updateAdminSeries(ctx, editor, series.id, {
          title: 'Renamed series',
          description: 'New.',
        }),
      ).toEqual({ ok: true });
      expect((await getAdminSeriesDetail(ctx, editor, series.id)).series).toMatchObject({
        title: 'Renamed series',
        description: 'New.',
        published: false,
      });
    });

    it('deleting a series frees its episodes as standalone videos', async () => {
      await createAdminSeries(ctx, editor, { title: 'Delete test', description: '' });
      const series = (await listAdminSeries(ctx, editor)).find((s) => s.title === 'Delete test')!;
      const v = await seedVideo(t.setup);
      await setAdminEpisode(ctx, editor, v.id, series.id, 1, 1);

      expect(await deleteAdminSeries(ctx, editor, series.id)).toEqual({ ok: true });
      expect((await listAdminSeries(ctx, editor)).some((x) => x.id === series.id)).toBe(false);
      const [row] = await t.setup.select().from(videos).where(eq(videos.id, v.id));
      expect(row?.kind).toBe('standalone');
      await expect(getAdminSeriesDetail(ctx, editor, series.id)).rejects.toThrow(/not found/i);
    });
  });
});
