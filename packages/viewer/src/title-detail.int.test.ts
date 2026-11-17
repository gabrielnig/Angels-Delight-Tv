import { captionTracks, captions, slugRedirects, videos } from '@ad/db';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { addToMyList } from './my-list';
import { saveProgress } from './progress';
import { getTitleDetail } from './title-detail';
import {
  categorize,
  createHarness,
  NOW,
  seedAccount,
  seedAsset,
  seedCategory,
  seedSeries,
  seedVideo,
  type ViewerHarness,
} from './testing';
import { uuidv7 } from '@ad/shared';

const later = (seconds: number) => new Date(NOW.getTime() + seconds * 1000);

describe.skipIf(!process.env.TEST_DATABASE_ADMIN_URL)('title detail', () => {
  let h: ViewerHarness;

  beforeAll(async () => {
    h = await createHarness();
  });
  afterAll(async () => {
    await h?.drop();
  });

  async function approveCaptions(videoId: string, language = 'en') {
    const reviewer = await seedAccount(h.db.setup, 'editor');
    const trackId = uuidv7();
    const captionId = uuidv7();
    await h.db.setup.transaction(async (tx) => {
      await tx.insert(captionTracks).values({
        id: trackId,
        videoId,
        language,
        label: 'English',
        kind: 'captions',
        isDefault: true,
      });
      await tx.insert(captions).values({
        id: captionId,
        trackId,
        revision: 1,
        source: 'manual',
        status: 'approved',
        storageKey: 'cap/x',
        publicKey: 'cap/x/en/aaaaaaaa.vtt',
        sha256: Buffer.alloc(32),
        bytes: 10,
        cueCount: 1,
        reviewedBy: reviewer.id,
      });
      await tx
        .update(captionTracks)
        .set({ approvedCaptionId: captionId })
        .where(eq(captionTracks.id, trackId));
    });
  }

  async function setup() {
    h.setNow(NOW);
    const user = await h.makeUser();
    const open = (key: Record<string, string>, profileId = user.profileId) =>
      getTitleDetail(h.ctx, user.actor, { profileId, ...key });
    return { user, open };
  }

  describe('a video', () => {
    it('describes the video with its categories, hero art and caption languages', async () => {
      const { open } = await setup();
      const art = await seedAsset(h.db.setup, { purpose: 'hero' });
      const shelf = await seedCategory(h.db.setup, 'Detail shelf');
      const video = await seedVideo(h.db.setup, {
        title: 'Detail video',
        description: 'About this video',
        heroAssetId: art,
        language: 'yo',
      });
      await categorize(h.db.setup, { videoId: video.id }, shelf.id);
      await approveCaptions(video.id);

      const detail = await open({ slug: video.slug });

      expect(detail).toMatchObject({
        type: 'video',
        card: { title: 'Detail video', description: 'About this video', hasCaptions: true },
        language: 'yo',
        categories: [{ name: 'Detail shelf' }],
        captionTracks: [{ language: 'en', label: 'English' }],
        play: { videoId: video.id, label: 'play', startMs: 0 },
        progress: null,
      });
      expect(detail.type === 'video' && detail.hero?.id).toBe(art);
    });

    it('can be opened by id as well as by slug', async () => {
      const { open } = await setup();
      const video = await seedVideo(h.db.setup);

      const byId = await open({ id: video.id });
      const bySlug = await open({ slug: video.slug });

      expect(byId).toEqual(bySlug);
    });

    it('offers Resume from 3 seconds before the saved position and reports the list state', async () => {
      const { user, open } = await setup();
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

      const detail = await open({ id: video.id });

      expect(detail).toMatchObject({
        type: 'video',
        play: { label: 'resume', startMs: 131_000 },
        progress: { positionMs: 134_000 },
        card: { inMyList: true },
      });
    });

    it('offers Watch again from the start for a finished video', async () => {
      const { user, open } = await setup();
      const video = await seedVideo(h.db.setup, { durationMs: 100_000 });
      await saveProgress(h.ctx, user.actor, {
        profileId: user.profileId,
        videoId: video.id,
        positionMs: 99_000,
      });

      const detail = await open({ id: video.id });

      expect(detail).toMatchObject({ play: { label: 'watch_again', startMs: 0 } });
    });

    it('lists up to 12 related titles from shared categories, never itself or hidden ones', async () => {
      const { open } = await setup();
      const shelf = await seedCategory(h.db.setup, 'Related detail shelf');
      const base = await seedVideo(h.db.setup, { title: 'Base' });
      await categorize(h.db.setup, { videoId: base.id }, shelf.id);
      for (let i = 0; i < 14; i++) {
        const sibling = await seedVideo(h.db.setup, {
          title: `Sibling ${i}`,
          publishState: i === 0 ? 'draft' : 'published',
        });
        await categorize(h.db.setup, { videoId: sibling.id }, shelf.id);
      }

      const detail = await open({ id: base.id });

      expect(detail.type === 'video' && detail.related).toHaveLength(12);
      expect(detail.type === 'video' && detail.related.map((c) => c.title)).not.toContain('Base');
      expect(detail.type === 'video' && detail.related.map((c) => c.title)).not.toContain(
        'Sibling 0',
      );
    });
  });

  describe('a series', () => {
    it('lists seasons and episodes in order with progress and watched ticks', async () => {
      const { user, open } = await setup();
      const series = await seedSeries(h.db.setup, {
        series: { title: 'Detail series' },
        seasonSizes: [2, 1],
        episode: { durationMs: 100_000 },
      });
      await saveProgress(h.ctx, user.actor, {
        profileId: user.profileId,
        videoId: series.episodes[0]!.id,
        positionMs: 99_000,
      });
      h.setNow(later(60));
      await saveProgress(h.ctx, user.actor, {
        profileId: user.profileId,
        videoId: series.episodes[1]!.id,
        positionMs: 40_000,
      });

      const detail = await open({ slug: series.slug, kind: 'series' });

      expect(detail.type).toBe('series');
      if (detail.type !== 'series') return;
      expect(detail.seasons.map((s) => s.episodes.map((e) => e.video.episode?.number))).toEqual([
        [1, 2],
        [1],
      ]);
      expect(detail.seasons[0]?.episodes[0]).toMatchObject({
        watched: true,
        progress: { completed: true },
      });
      expect(detail.seasons[0]?.episodes[1]).toMatchObject({
        watched: false,
        progress: { positionMs: 40_000 },
      });
      expect(detail.play).toMatchObject({
        videoId: series.episodes[1]!.id,
        label: 'resume',
        episode: { seasonNumber: 1, number: 2 },
      });
    });

    it('does not list unpublished episodes', async () => {
      const { open } = await setup();
      const series = await seedSeries(h.db.setup, { seasonSizes: [3] });
      await h.db.setup
        .update(videos)
        .set({ publishState: 'unpublished' })
        .where(eq(videos.id, series.episodes[1]!.id));

      const detail = await open({ id: series.id, kind: 'series' });

      expect(detail.type === 'series' && detail.seasons[0]?.episodes).toHaveLength(2);
    });

    it('is not found when it has no published episode', async () => {
      const { open } = await setup();
      const series = await seedSeries(h.db.setup, { episode: { publishState: 'draft' } });

      await expect(open({ id: series.id })).rejects.toMatchObject({ code: 'not_found' });
    });

    it('sends the page of an episode to its series with that episode focused', async () => {
      const { open } = await setup();
      const series = await seedSeries(h.db.setup);
      const episodeSlug = (
        await h.db.setup.select().from(videos).where(eq(videos.id, series.episodes[1]!.id))
      )[0]!.slug;

      const detail = await open({ slug: episodeSlug });

      expect(detail).toEqual({
        type: 'redirect',
        to: { kind: 'series', slug: series.slug, episodeId: series.episodes[1]!.id },
      });
    });
  });

  describe('hidden and renamed titles', () => {
    it.each([
      ['a draft', { publishState: 'draft' as const }],
      ['an unpublished video', { publishState: 'unpublished' as const }],
      [
        'a scheduled video that is not due',
        { publishState: 'scheduled' as const, publishAt: later(86400) },
      ],
    ])(
      'answers not found for %s, the same as for a title that never existed',
      async (_label, overrides) => {
        const { open } = await setup();
        const video = await seedVideo(h.db.setup, overrides);

        const hidden = await open({ id: video.id }).catch((error: unknown) => error);
        const missing = await open({ id: uuidv7() }).catch((error: unknown) => error);

        expect(hidden).toMatchObject({ code: 'not_found', message: (missing as Error).message });
      },
    );

    it('answers not found for a kids profile opening a title that is not kids safe', async () => {
      const { user, open } = await setup();
      const adult = await seedVideo(h.db.setup, { kidsSafe: false });

      await expect(open({ id: adult.id }, user.kidsProfileId)).rejects.toMatchObject({
        code: 'not_found',
      });
      await expect(open({ slug: adult.slug }, user.kidsProfileId)).rejects.toMatchObject({
        code: 'not_found',
      });
    });

    it('answers a renamed slug with a redirect to the current one', async () => {
      const { open } = await setup();
      const video = await seedVideo(h.db.setup, { slug: 'new-name' });
      await h.db.setup.insert(slugRedirects).values({ oldSlug: 'old-name', videoId: video.id });

      expect(await open({ slug: 'old-name' })).toEqual({
        type: 'redirect',
        to: { kind: 'video', slug: 'new-name' },
      });
    });

    it('does not redirect an old slug whose title is hidden', async () => {
      const { open } = await setup();
      const video = await seedVideo(h.db.setup, { slug: 'hidden-new', publishState: 'draft' });
      await h.db.setup.insert(slugRedirects).values({ oldSlug: 'hidden-old', videoId: video.id });

      await expect(open({ slug: 'hidden-old' })).rejects.toMatchObject({ code: 'not_found' });
    });
  });

  describe('ownership', () => {
    it('answers not found for a profile of another account', async () => {
      const owner = await setup();
      const stranger = await h.makeUser();
      const video = await seedVideo(h.db.setup);

      await expect(
        getTitleDetail(h.ctx, stranger.actor, { profileId: owner.user.profileId, id: video.id }),
      ).rejects.toMatchObject({ code: 'not_found' });
    });

    it('shows each profile its own progress when both have watched the same title', async () => {
      const { user, open } = await setup();
      const video = await seedVideo(h.db.setup, { kidsSafe: true, durationMs: 200_000 });
      for (const [profileId, positionMs] of [
        [user.profileId, 50_000],
        [user.kidsProfileId, 120_000],
      ] as const) {
        await saveProgress(h.ctx, user.actor, { profileId, videoId: video.id, positionMs });
      }

      const adult = await open({ id: video.id });
      const child = await open({ id: video.id }, user.kidsProfileId);

      expect(adult).toMatchObject({ progress: { positionMs: 50_000 } });
      expect(child).toMatchObject({ progress: { positionMs: 120_000 } });
    });

    it('does not show one profile the progress of another on the same title', async () => {
      const { user, open } = await setup();
      const video = await seedVideo(h.db.setup, { kidsSafe: true, durationMs: 200_000 });
      await saveProgress(h.ctx, user.actor, {
        profileId: user.profileId,
        videoId: video.id,
        positionMs: 100_000,
      });

      const detail = await open({ id: video.id }, user.kidsProfileId);

      expect(detail).toMatchObject({ progress: null, play: { label: 'play', startMs: 0 } });
    });
  });
});
