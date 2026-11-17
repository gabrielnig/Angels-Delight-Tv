import { eq } from 'drizzle-orm';
import { videos, watchProgress } from '@ad/db';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { continueWatching, getProgress, removeProgress, saveProgress } from './progress';
import { createHarness, NOW, seedSeries, seedVideo, type ViewerHarness } from './testing';

const sec = (n: number) => n * 1000;
const later = (seconds: number) => new Date(NOW.getTime() + seconds * 1000);

describe.skipIf(!process.env.TEST_DATABASE_ADMIN_URL)('watch progress', () => {
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

  async function setup() {
    h.setNow(NOW);
    const user = await h.makeUser();
    const video = await seedVideo(h.db.setup, { durationMs: sec(100) });
    const save = (positionMs: number, extra: Partial<Parameters<typeof saveProgress>[2]> = {}) =>
      saveProgress(h.ctx, user.actor, {
        profileId: user.profileId,
        videoId: video.id,
        positionMs,
        ...extra,
      });
    return { user, video, save };
  }

  describe('start threshold', () => {
    it('creates no entry for less than 5 seconds', async () => {
      const { user, video, save } = await setup();

      const saved = await save(sec(4));

      expect(saved).toBeNull();
      expect(
        await getProgress(h.ctx, user.actor, { profileId: user.profileId, videoId: video.id }),
      ).toBeNull();
    });

    it('leaves an existing entry unchanged when a later write is under 5 seconds', async () => {
      const { user, video, save } = await setup();
      await save(sec(40));
      h.setNow(later(60));

      await save(sec(2));

      const progress = await getProgress(h.ctx, user.actor, {
        profileId: user.profileId,
        videoId: video.id,
      });
      expect(progress?.positionMs).toBe(sec(40));
    });

    it('creates the entry at exactly 5 seconds', async () => {
      const { save } = await setup();

      const saved = await save(sec(5));

      expect(saved).toMatchObject({ positionMs: sec(5), completed: false, durationMs: sec(100) });
    });
  });

  describe('finish threshold', () => {
    it('marks a title finished at 95 percent and resets the position to 0', async () => {
      const { save } = await setup();

      const saved = await save(sec(95));

      expect(saved).toMatchObject({ completed: true, positionMs: 0 });
    });

    it('does not finish at 94 percent of a long video and finishes at 95 percent', async () => {
      h.setNow(NOW);
      const user = await h.makeUser();
      const long = await seedVideo(h.db.setup, { durationMs: sec(1000) });
      const write = (positionMs: number) =>
        saveProgress(h.ctx, user.actor, {
          profileId: user.profileId,
          videoId: long.id,
          positionMs,
        });

      expect((await write(sec(940)))?.completed).toBe(false);
      h.setNow(later(5));
      expect((await write(sec(950)))?.completed).toBe(true);
    });

    it('marks a title finished once 10 seconds remain, which comes before 95 percent on a short video', async () => {
      const { save } = await setup();

      expect((await save(sec(89)))?.completed).toBe(false);
      h.setNow(later(5));
      expect((await save(sec(90)))?.completed).toBe(true);
    });

    it('applies the last 10 seconds rule to a video under 40 seconds', async () => {
      h.setNow(NOW);
      const user = await h.makeUser();
      const tiny = await seedVideo(h.db.setup, { durationMs: sec(30) });
      const write = (positionMs: number) =>
        saveProgress(h.ctx, user.actor, {
          profileId: user.profileId,
          videoId: tiny.id,
          positionMs,
        });

      expect((await write(sec(19)))?.completed).toBe(false);
      h.setNow(later(5));
      expect((await write(sec(20)))?.completed).toBe(true);
    });

    it('treats the ended event as finished even from the middle of a video', async () => {
      const { save } = await setup();

      expect((await save(sec(50), { ended: true }))?.completed).toBe(true);
    });

    it('brings a finished title back once it is watched past 5 seconds again', async () => {
      const { user, video, save } = await setup();
      await save(sec(96));
      h.setNow(later(120));

      await save(sec(30));

      const progress = await getProgress(h.ctx, user.actor, {
        profileId: user.profileId,
        videoId: video.id,
      });
      expect(progress).toMatchObject({ completed: false, positionMs: sec(30) });
    });

    it('clamps a position beyond the duration', async () => {
      const { save } = await setup();

      expect((await save(sec(500)))?.completed).toBe(true);
    });
  });

  describe('resume position', () => {
    it('starts 3 seconds before the saved position', async () => {
      const { user, video, save } = await setup();
      await save(sec(40));

      const progress = await getProgress(h.ctx, user.actor, {
        profileId: user.profileId,
        videoId: video.id,
      });

      expect(progress).toMatchObject({
        positionMs: sec(40),
        resumeFromMs: sec(37),
        label: 'resume',
      });
    });

    it('starts at the saved position when the rewind is configured to 0', async () => {
      const zero = await createHarness({ rules: { resumeRewindMs: 0 } });
      try {
        const user = await zero.makeUser();
        const video = await seedVideo(zero.db.setup, { durationMs: sec(100) });
        await saveProgress(zero.ctx, user.actor, {
          profileId: user.profileId,
          videoId: video.id,
          positionMs: sec(40),
        });

        const progress = await getProgress(zero.ctx, user.actor, {
          profileId: user.profileId,
          videoId: video.id,
        });

        expect(progress?.resumeFromMs).toBe(sec(40));
      } finally {
        await zero.drop();
      }
    });

    it('offers watch again from the start for a finished title', async () => {
      const { user, video, save } = await setup();
      await save(sec(99));

      const progress = await getProgress(h.ctx, user.actor, {
        profileId: user.profileId,
        videoId: video.id,
      });

      expect(progress).toMatchObject({ completed: true, resumeFromMs: 0, label: 'watch_again' });
    });
  });

  describe('writes from two devices', () => {
    it('ignores a write older than the stored one', async () => {
      const { user, video, save } = await setup();
      h.setNow(later(100));
      await save(sec(60));

      await save(sec(20), { clientTimestamp: later(50).toISOString(), seek: true });

      const progress = await getProgress(h.ctx, user.actor, {
        profileId: user.profileId,
        videoId: video.id,
      });
      expect(progress?.positionMs).toBe(sec(60));
    });

    it('lets the later client timestamp win', async () => {
      const { user, video, save } = await setup();
      await save(sec(20));

      h.setNow(later(30));
      await save(sec(60), { clientTimestamp: later(20).toISOString() });

      const progress = await getProgress(h.ctx, user.actor, {
        profileId: user.profileId,
        videoId: video.id,
      });
      expect(progress?.positionMs).toBe(sec(60));
    });

    it('ignores a large backward jump right after a write unless it is a seek', async () => {
      const { user, video, save } = await setup();
      await save(sec(80));
      h.setNow(later(2));
      await save(sec(10));
      const unchanged = await getProgress(h.ctx, user.actor, {
        profileId: user.profileId,
        videoId: video.id,
      });
      expect(unchanged?.positionMs).toBe(sec(80));

      h.setNow(later(3));
      await save(sec(10), { seek: true });
      const moved = await getProgress(h.ctx, user.actor, {
        profileId: user.profileId,
        videoId: video.id,
      });
      expect(moved?.positionMs).toBe(sec(10));
    });

    it('accepts a backward jump once the guard window has passed', async () => {
      const { user, video, save } = await setup();
      await save(sec(80));
      h.setNow(later(60));

      await save(sec(10));

      const progress = await getProgress(h.ctx, user.actor, {
        profileId: user.profileId,
        videoId: video.id,
      });
      expect(progress?.positionMs).toBe(sec(10));
    });

    it('lets a finish event win over a newer position', async () => {
      const { user, video, save } = await setup();
      h.setNow(later(100));
      await save(sec(60));

      await save(sec(99), { clientTimestamp: later(90).toISOString() });

      const progress = await getProgress(h.ctx, user.actor, {
        profileId: user.profileId,
        videoId: video.id,
      });
      expect(progress?.completed).toBe(true);
    });

    it('replaces a client timestamp that is far from server time with the server time', async () => {
      const { user, video, save } = await setup();

      await save(sec(30), { clientTimestamp: '2031-01-01T00:00:00Z' });
      const afterGarbage = await save(sec(40), { clientTimestamp: 'not a date' });

      expect(afterGarbage?.positionMs).toBe(sec(30));
      const progress = await getProgress(h.ctx, user.actor, {
        profileId: user.profileId,
        videoId: video.id,
      });
      expect(progress?.updatedAt).toBe(NOW.toISOString());
    });
  });

  describe('access rules', () => {
    it('answers not found for a video that is not published and writes nothing', async () => {
      h.setNow(NOW);
      const user = await h.makeUser();
      const draft = await seedVideo(h.db.setup, { publishState: 'draft' });

      await expect(
        saveProgress(h.ctx, user.actor, {
          profileId: user.profileId,
          videoId: draft.id,
          positionMs: sec(30),
        }),
      ).rejects.toMatchObject({ code: 'not_found' });
      expect(
        await h.db.setup.select().from(watchProgress).where(eq(watchProgress.videoId, draft.id)),
      ).toEqual([]);
    });

    it('answers not found when a kids profile writes progress for a title that is not kids safe', async () => {
      h.setNow(NOW);
      const user = await h.makeUser();
      const adultVideo = await seedVideo(h.db.setup, { kidsSafe: false });

      await expect(
        saveProgress(h.ctx, user.actor, {
          profileId: user.kidsProfileId,
          videoId: adultVideo.id,
          positionMs: sec(30),
        }),
      ).rejects.toMatchObject({ code: 'not_found' });
    });

    it('answers not found for a profile of another account and writes nothing', async () => {
      h.setNow(NOW);
      const owner = await h.makeUser();
      const stranger = await h.makeUser();
      const video = await seedVideo(h.db.setup);

      await expect(
        saveProgress(h.ctx, stranger.actor, {
          profileId: owner.profileId,
          videoId: video.id,
          positionMs: sec(30),
        }),
      ).rejects.toMatchObject({ code: 'not_found' });
      await expect(
        getProgress(h.ctx, stranger.actor, { profileId: owner.profileId, videoId: video.id }),
      ).rejects.toMatchObject({ code: 'not_found' });
      await expect(
        continueWatching(h.ctx, stranger.actor, { profileId: owner.profileId }),
      ).rejects.toMatchObject({ code: 'not_found' });
      expect(
        await h.db.setup
          .select()
          .from(watchProgress)
          .where(eq(watchProgress.profileId, owner.profileId)),
      ).toEqual([]);
    });

    it('keeps progress separate between profiles of one account', async () => {
      h.setNow(NOW);
      const user = await h.makeUser();
      const video = await seedVideo(h.db.setup, { durationMs: sec(100), kidsSafe: true });
      await saveProgress(h.ctx, user.actor, {
        profileId: user.profileId,
        videoId: video.id,
        positionMs: sec(40),
      });

      const other = await getProgress(h.ctx, user.actor, {
        profileId: user.kidsProfileId,
        videoId: video.id,
      });

      expect(other).toBeNull();
      expect(await continueWatching(h.ctx, user.actor, { profileId: user.kidsProfileId })).toEqual(
        [],
      );
    });

    it('limits how often progress can be written', async () => {
      limited.setNow(NOW);
      const user = await limited.makeUser();
      const video = await seedVideo(limited.db.setup);

      await expect(
        saveProgress(limited.ctx, user.actor, {
          profileId: user.profileId,
          videoId: video.id,
          positionMs: sec(30),
        }),
      ).rejects.toMatchObject({ code: 'rate_limited' });
    });
  });

  describe('removeProgress', () => {
    it('clears the position so the title starts from the beginning', async () => {
      const { user, video, save } = await setup();
      await save(sec(40));

      await removeProgress(h.ctx, user.actor, { profileId: user.profileId, videoId: video.id });

      expect(
        await getProgress(h.ctx, user.actor, { profileId: user.profileId, videoId: video.id }),
      ).toBeNull();
    });

    it('does not touch another profile with the same video', async () => {
      const { user, video, save } = await setup();
      await save(sec(40));
      await saveProgress(h.ctx, user.actor, {
        profileId: user.kidsProfileId,
        videoId: video.id,
        positionMs: sec(40),
      }).catch(() => null);

      await removeProgress(h.ctx, user.actor, { profileId: user.kidsProfileId, videoId: video.id });

      expect(
        await getProgress(h.ctx, user.actor, { profileId: user.profileId, videoId: video.id }),
      ).not.toBeNull();
    });
  });

  describe('continueWatching', () => {
    it('lists unfinished titles, most recent first, with their progress', async () => {
      h.setNow(NOW);
      const user = await h.makeUser();
      const first = await seedVideo(h.db.setup, { title: 'Watched first', durationMs: sec(100) });
      const second = await seedVideo(h.db.setup, { title: 'Watched second', durationMs: sec(100) });
      const finished = await seedVideo(h.db.setup, { title: 'Finished', durationMs: sec(100) });
      const write = (videoId: string, positionMs: number) =>
        saveProgress(h.ctx, user.actor, { profileId: user.profileId, videoId, positionMs });
      await write(first.id, sec(30));
      h.setNow(later(10));
      await write(second.id, sec(50));
      h.setNow(later(20));
      await write(finished.id, sec(99));

      const row = await continueWatching(h.ctx, user.actor, { profileId: user.profileId });

      expect(row.map((item) => item.video.title)).toEqual(['Watched second', 'Watched first']);
      expect(row[0]).toMatchObject({
        positionMs: sec(50),
        durationMs: sec(100),
        nextUp: false,
        resumeFromMs: sec(47),
      });
    });

    it('drops the oldest entries beyond 20 but keeps them as history', async () => {
      h.setNow(NOW);
      const user = await h.makeUser();
      for (let i = 0; i < 22; i++) {
        const video = await seedVideo(h.db.setup, { title: `Many ${i}`, durationMs: sec(100) });
        h.setNow(later(i));
        await saveProgress(h.ctx, user.actor, {
          profileId: user.profileId,
          videoId: video.id,
          positionMs: sec(30),
        });
      }

      const row = await continueWatching(h.ctx, user.actor, { profileId: user.profileId });

      expect(row).toHaveLength(20);
      expect(row[0]?.video.title).toBe('Many 21');
      const stored = await h.db.setup
        .select()
        .from(watchProgress)
        .where(eq(watchProgress.profileId, user.profileId));
      expect(stored).toHaveLength(22);
    });

    it('hides titles that were unpublished and shows them again when republished', async () => {
      const { user, video, save } = await setup();
      await save(sec(40));
      await h.db.setup
        .update(videos)
        .set({ publishState: 'unpublished' })
        .where(eq(videos.id, video.id));
      expect(await continueWatching(h.ctx, user.actor, { profileId: user.profileId })).toEqual([]);

      await h.db.setup
        .update(videos)
        .set({ publishState: 'published' })
        .where(eq(videos.id, video.id));

      expect(await continueWatching(h.ctx, user.actor, { profileId: user.profileId })).toHaveLength(
        1,
      );
    });

    it('hides non kid titles from a kids profile whose data is kept', async () => {
      h.setNow(NOW);
      const user = await h.makeUser();
      const video = await seedVideo(h.db.setup, { kidsSafe: true, durationMs: sec(100) });
      await saveProgress(h.ctx, user.actor, {
        profileId: user.kidsProfileId,
        videoId: video.id,
        positionMs: sec(30),
      });
      await h.db.setup.update(videos).set({ kidsSafe: false }).where(eq(videos.id, video.id));

      const row = await continueWatching(h.ctx, user.actor, { profileId: user.kidsProfileId });

      expect(row).toEqual([]);
      const stored = await h.db.setup
        .select()
        .from(watchProgress)
        .where(eq(watchProgress.profileId, user.kidsProfileId));
      expect(stored).toHaveLength(1);
    });

    it('drops entries not touched for 60 days from the row but still resumes the title directly', async () => {
      const { user, video, save } = await setup();
      await save(sec(40));
      h.setNow(new Date(NOW.getTime() + 61 * 24 * 3600 * 1000));

      expect(await continueWatching(h.ctx, user.actor, { profileId: user.profileId })).toEqual([]);
      const direct = await getProgress(h.ctx, user.actor, {
        profileId: user.profileId,
        videoId: video.id,
      });
      expect(direct?.positionMs).toBe(sec(40));
    });

    it('starts empty for a new profile', async () => {
      h.setNow(NOW);
      const user = await h.makeUser();

      expect(await continueWatching(h.ctx, user.actor, { profileId: user.profileId })).toEqual([]);
    });
  });

  describe('series in continueWatching', () => {
    async function seriesSetup(episodeCount = 4) {
      h.setNow(NOW);
      const user = await h.makeUser();
      const series = await seedSeries(h.db.setup, {
        series: { title: 'Course' },
        seasonSizes: [episodeCount],
        episode: { durationMs: sec(100) },
      });
      let minutes = 0;
      const write = (episodeIndex: number, positionMs: number) => {
        h.setNow(later(60 * ++minutes));
        return saveProgress(h.ctx, user.actor, {
          profileId: user.profileId,
          videoId: series.episodes[episodeIndex]!.id,
          positionMs,
        });
      };
      const row = () => continueWatching(h.ctx, user.actor, { profileId: user.profileId });
      return { user, series, write, row };
    }

    it('shows one card per series, the most recently watched unfinished episode', async () => {
      const { series, write, row } = await seriesSetup();
      await write(3, sec(30));
      await write(1, sec(40));

      const items = await row();

      expect(items).toHaveLength(1);
      expect(items[0]).toMatchObject({ nextUp: false, positionMs: sec(40) });
      expect(items[0]?.video.id).toBe(series.episodes[1]!.id);
    });

    it('replaces a finished episode with the next one at position 0', async () => {
      const { series, write, row } = await seriesSetup();
      await write(2, sec(99));

      const items = await row();

      expect(items).toHaveLength(1);
      expect(items[0]).toMatchObject({ nextUp: true, positionMs: 0, resumeFromMs: 0 });
      expect(items[0]?.video.id).toBe(series.episodes[3]!.id);
      expect(items[0]?.video.episode).toMatchObject({ number: 4 });
    });

    it('removes the series from the row once its last episode is finished', async () => {
      const { write, row } = await seriesSetup();
      await write(3, sec(99));

      expect(await row()).toEqual([]);
    });

    it('removes the series when the next episode is not published', async () => {
      const { series, write, row } = await seriesSetup();
      await write(1, sec(99));
      await h.db.setup
        .update(videos)
        .set({ publishState: 'unpublished' })
        .where(eq(videos.id, series.episodes[2]!.id));

      expect(await row()).toEqual([]);
    });
  });
});
