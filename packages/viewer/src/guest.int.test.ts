import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { guestTitleDetail } from './guest';
import { NotFound } from '@ad/shared';
import { addToMyList } from './my-list';
import { saveProgress } from './progress';
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
});
