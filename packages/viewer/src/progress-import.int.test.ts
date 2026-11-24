import { and, eq } from 'drizzle-orm';
import { watchProgress } from '@ad/db';
import { NotFound, RateLimited, ValidationFailed } from '@ad/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { importGuestProgress, MAX_IMPORT_ITEMS } from './progress-import';
import { saveProgress } from './progress';
import { createHarness, NOW, seedVideo, type ViewerHarness } from './testing';

const sec = (n: number) => n * 1000;

describe.skipIf(!process.env.TEST_DATABASE_ADMIN_URL)('history import (M40-S17)', () => {
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

  const rows = (profileId: string) =>
    h.db.setup.select().from(watchProgress).where(eq(watchProgress.profileId, profileId));

  it('saves positions for published videos and takes the duration from the server', async () => {
    h.setNow(NOW);
    const user = await h.makeUser();
    const video = await seedVideo(h.db.setup, { durationMs: sec(100) });
    const result = await importGuestProgress(h.ctx, user.actor, {
      profileId: user.profileId,
      items: [
        {
          videoId: video.id,
          positionMs: sec(40),
          finished: false,
          updatedAt: NOW.getTime() - 1000,
        },
      ],
    });
    expect(result).toEqual({ imported: 1, skipped: 0 });
    const [row] = await rows(user.profileId);
    expect(row).toMatchObject({
      videoId: video.id,
      positionMs: sec(40),
      durationMs: sec(100),
      completed: false,
    });
  });

  it('records a finished video as watched and clamps a position past the end', async () => {
    h.setNow(NOW);
    const user = await h.makeUser();
    const done = await seedVideo(h.db.setup, { durationMs: sec(100) });
    const far = await seedVideo(h.db.setup, { durationMs: sec(100) });
    await importGuestProgress(h.ctx, user.actor, {
      profileId: user.profileId,
      items: [
        { videoId: done.id, positionMs: sec(100), finished: true, updatedAt: NOW.getTime() },
        { videoId: far.id, positionMs: sec(5000), finished: false, updatedAt: NOW.getTime() },
      ],
    });
    const byVideo = new Map((await rows(user.profileId)).map((r) => [r.videoId, r]));
    expect(byVideo.get(done.id)).toMatchObject({ completed: true, positionMs: 0 });
    expect(byVideo.get(far.id)?.completed).toBe(true);
  });

  it('never overwrites progress the account already has', async () => {
    h.setNow(NOW);
    const user = await h.makeUser();
    const video = await seedVideo(h.db.setup, { durationMs: sec(100) });
    await saveProgress(h.ctx, user.actor, {
      profileId: user.profileId,
      videoId: video.id,
      positionMs: sec(70),
    });
    const result = await importGuestProgress(h.ctx, user.actor, {
      profileId: user.profileId,
      items: [
        { videoId: video.id, positionMs: sec(10), finished: false, updatedAt: NOW.getTime() + 5 },
      ],
    });
    expect(result).toEqual({ imported: 0, skipped: 1 });
    const [row] = await rows(user.profileId);
    expect(row!.positionMs).toBe(sec(70));
  });

  it('skips ids that are not videos this profile can watch, and positions under the start threshold', async () => {
    h.setNow(NOW);
    const user = await h.makeUser();
    const adult = await seedVideo(h.db.setup, { durationMs: sec(100), kidsSafe: false });
    const early = await seedVideo(h.db.setup, { durationMs: sec(100) });
    const result = await importGuestProgress(h.ctx, user.actor, {
      profileId: user.kidsProfileId,
      items: [
        { videoId: adult.id, positionMs: sec(30), finished: false, updatedAt: NOW.getTime() },
        { videoId: early.id, positionMs: sec(2), finished: false, updatedAt: NOW.getTime() },
        { videoId: 'not-a-uuid', positionMs: sec(30), finished: false, updatedAt: NOW.getTime() },
        {
          videoId: '00000000-0000-4000-8000-000000000000',
          positionMs: sec(30),
          finished: false,
          updatedAt: NOW.getTime(),
        },
      ],
    });
    expect(result).toEqual({ imported: 0, skipped: 4 });
    expect(await rows(user.kidsProfileId)).toHaveLength(0);
  });

  it('refuses a batch over the limit and a profile the account does not own', async () => {
    h.setNow(NOW);
    const user = await h.makeUser();
    const other = await h.makeUser();
    const video = await seedVideo(h.db.setup, { durationMs: sec(100) });
    const item = {
      videoId: video.id,
      positionMs: sec(30),
      finished: false,
      updatedAt: NOW.getTime(),
    };
    await expect(
      importGuestProgress(h.ctx, user.actor, {
        profileId: user.profileId,
        items: Array.from({ length: MAX_IMPORT_ITEMS + 1 }, () => item),
      }),
    ).rejects.toBeInstanceOf(ValidationFailed);
    await expect(
      importGuestProgress(h.ctx, user.actor, { profileId: other.profileId, items: [item] }),
    ).rejects.toBeInstanceOf(NotFound);
    expect(await rows(other.profileId)).toHaveLength(0);
  });

  it('is limited like other progress writes', async () => {
    limited.setNow(NOW);
    const user = await limited.makeUser();
    await expect(
      importGuestProgress(limited.ctx, user.actor, { profileId: user.profileId, items: [] }),
    ).rejects.toBeInstanceOf(RateLimited);
  });

  it('never trusts a timestamp from the future', async () => {
    h.setNow(NOW);
    const user = await h.makeUser();
    const video = await seedVideo(h.db.setup, { durationMs: sec(100) });
    await importGuestProgress(h.ctx, user.actor, {
      profileId: user.profileId,
      items: [
        {
          videoId: video.id,
          positionMs: sec(40),
          finished: false,
          updatedAt: NOW.getTime() + 86_400_000,
        },
      ],
    });
    const [row] = await h.db.setup
      .select()
      .from(watchProgress)
      .where(and(eq(watchProgress.profileId, user.profileId), eq(watchProgress.videoId, video.id)));
    expect(row!.updatedAt.getTime()).toBeLessThanOrEqual(NOW.getTime());
  });
});
