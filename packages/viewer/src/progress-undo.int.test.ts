import { eq, sql } from 'drizzle-orm';
import { watchProgress } from '@ad/db';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  getProgress,
  PROGRESS_UNDO_WINDOW_MS,
  removeProgress,
  restoreProgress,
  saveProgress,
} from './progress';
import { createHarness, NOW, seedVideo, type ViewerHarness } from './testing';

const sec = (n: number) => n * 1000;
const after = (ms: number) => new Date(NOW.getTime() + ms);

describe.skipIf(!process.env.TEST_DATABASE_ADMIN_URL)(
  'undo of Remove from Continue Watching (M09-S07)',
  () => {
    let h: ViewerHarness;
    beforeAll(async () => {
      h = await createHarness();
    });
    afterAll(async () => {
      await h?.drop();
    });

    async function setup() {
      h.setNow(NOW);
      const user = await h.makeUser();
      const video = await seedVideo(h.db.setup, { durationMs: sec(100) });
      await saveProgress(h.ctx, user.actor, {
        profileId: user.profileId,
        videoId: video.id,
        positionMs: sec(40),
      });
      return { user, video };
    }
    const ids = (u: { profileId: string }, v: { id: string }) => ({
      profileId: u.profileId,
      videoId: v.id,
    });

    it('puts the position back after a removal, with nothing held in memory', async () => {
      const { user, video } = await setup();
      await removeProgress(h.ctx, user.actor, ids(user, video));
      expect(await getProgress(h.ctx, user.actor, ids(user, video))).toBeNull();

      expect(
        await restoreProgress(h.ctx, user.actor, {
          profileId: user.profileId,
          requestedId: video.id,
        }),
      ).toBe(true);
      const back = await getProgress(h.ctx, user.actor, ids(user, video));
      expect(back?.positionMs).toBe(sec(40));
    });

    it('works from another process: the position is read from the database, not from a stash', async () => {
      const { user, video } = await setup();
      await removeProgress(h.ctx, user.actor, ids(user, video));
      const rows = await h.db.setup.execute(
        sql`SELECT position_ms FROM watch_progress_removals WHERE profile_id = ${user.profileId}::uuid`,
      );
      expect(JSON.stringify(rows)).toContain('40000');
    });

    it('can only be undone once', async () => {
      const { user, video } = await setup();
      await removeProgress(h.ctx, user.actor, ids(user, video));
      const input = { profileId: user.profileId, requestedId: video.id };
      expect(await restoreProgress(h.ctx, user.actor, input)).toBe(true);
      expect(await restoreProgress(h.ctx, user.actor, input)).toBe(false);
    });

    it('expires after the window and then does nothing', async () => {
      const { user, video } = await setup();
      await removeProgress(h.ctx, user.actor, ids(user, video));
      h.setNow(after(PROGRESS_UNDO_WINDOW_MS + 1000));
      expect(
        await restoreProgress(h.ctx, user.actor, {
          profileId: user.profileId,
          requestedId: video.id,
        }),
      ).toBe(false);
      expect(await getProgress(h.ctx, user.actor, ids(user, video))).toBeNull();
    });

    it('never overwrites progress made after the removal', async () => {
      const { user, video } = await setup();
      await removeProgress(h.ctx, user.actor, ids(user, video));
      h.setNow(after(sec(30)));
      await saveProgress(h.ctx, user.actor, { ...ids(user, video), positionMs: sec(10) });
      expect(
        await restoreProgress(h.ctx, user.actor, {
          profileId: user.profileId,
          requestedId: video.id,
        }),
      ).toBe(false);
      const now = await getProgress(h.ctx, user.actor, ids(user, video));
      expect(now?.positionMs).toBe(sec(10));
    });

    it('records nothing when there was no progress to remove', async () => {
      h.setNow(NOW);
      const user = await h.makeUser();
      const video = await seedVideo(h.db.setup, { durationMs: sec(100) });
      await removeProgress(h.ctx, user.actor, ids(user, video));
      expect(
        await restoreProgress(h.ctx, user.actor, {
          profileId: user.profileId,
          requestedId: video.id,
        }),
      ).toBe(false);
    });

    it('is private to the profile: another account cannot restore it', async () => {
      const { user, video } = await setup();
      await removeProgress(h.ctx, user.actor, ids(user, video));
      h.setNow(NOW);
      const other = await h.makeUser();
      await expect(
        restoreProgress(h.ctx, other.actor, { profileId: user.profileId, requestedId: video.id }),
      ).rejects.toThrow();
      const [row] = await h.db.setup
        .select()
        .from(watchProgress)
        .where(eq(watchProgress.profileId, user.profileId));
      expect(row).toBeUndefined();
    });

    it('clears old undo records when the next removal happens', async () => {
      const { user, video } = await setup();
      await removeProgress(h.ctx, user.actor, ids(user, video));
      h.setNow(after(PROGRESS_UNDO_WINDOW_MS * 3));
      const other = await seedVideo(h.db.setup, { durationMs: sec(100) });
      await saveProgress(h.ctx, user.actor, { ...ids(user, other), positionMs: sec(20) });
      await removeProgress(h.ctx, user.actor, ids(user, other));
      const rows = await h.db.setup.execute(
        sql`SELECT count(*)::int AS n FROM watch_progress_removals WHERE profile_id = ${user.profileId}::uuid`,
      );
      expect(JSON.stringify(rows)).toContain('"n":1');
    });
  },
);
