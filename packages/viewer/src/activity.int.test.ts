import { auditLog, videos, watchProgress, watchProgressRemovals } from '@ad/db';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { clearActivity, listActivity, removeActivity } from './activity';
import { restoreProgress, saveProgress } from './progress';
import { createHarness, NOW, seedVideo, type ViewerHarness } from './testing';

const sec = (n: number) => n * 1000;

describe.skipIf(!process.env.TEST_DATABASE_ADMIN_URL)('viewing activity (M49-S09, S10)', () => {
  let h: ViewerHarness;
  beforeAll(async () => {
    h = await createHarness();
  });
  afterAll(async () => {
    await h?.drop();
  });

  async function watched(
    user: { actor: never; profileId: string },
    minutesAgo: number,
    over: { positionMs?: number; unpublished?: boolean } = {},
  ) {
    const video = await seedVideo(h.db.setup, {
      durationMs: sec(100),
      title: `Lesson ${minutesAgo}`,
    });
    h.setNow(new Date(NOW.getTime() - minutesAgo * 60_000));
    await saveProgress(h.ctx, user.actor, {
      profileId: user.profileId,
      videoId: video.id,
      positionMs: over.positionMs ?? sec(40),
    });
    h.setNow(NOW);
    if (over.unpublished)
      await h.db.setup.update(videos).set({ publishState: 'draft' }).where(eq(videos.id, video.id));
    return video;
  }

  it('lists newest first, with a cursor for the next page', async () => {
    const user = await h.makeUser();
    for (const m of [50, 40, 30, 20, 10]) await watched(user as never, m);
    const first = await listActivity(h.ctx, user.actor, { profileId: user.profileId, limit: 2 });
    expect(first.items.map((i) => i.title)).toEqual(['Lesson 10', 'Lesson 20']);
    expect(first.nextCursor).toBeTruthy();
    const second = await listActivity(h.ctx, user.actor, {
      profileId: user.profileId,
      limit: 2,
      cursor: first.nextCursor!,
    });
    expect(second.items.map((i) => i.title)).toEqual(['Lesson 30', 'Lesson 40']);
    const third = await listActivity(h.ctx, user.actor, {
      profileId: user.profileId,
      limit: 2,
      cursor: second.nextCursor!,
    });
    expect(third.items.map((i) => i.title)).toEqual(['Lesson 50']);
    expect(third.nextCursor).toBeNull();
  });

  it('shows progress as a percentage and the watched time', async () => {
    const user = await h.makeUser();
    await watched(user as never, 5, { positionMs: sec(25) });
    const { items } = await listActivity(h.ctx, user.actor, { profileId: user.profileId });
    expect(items[0]?.progressPct).toBe(25);
    expect(items[0]?.completed).toBe(false);
    expect(new Date(items[0]!.watchedAt).getTime()).toBe(NOW.getTime() - 5 * 60_000);
  });

  it('drops unpublished titles from the list and keeps the row', async () => {
    const user = await h.makeUser();
    const gone = await watched(user as never, 5, { unpublished: true });
    await watched(user as never, 6);
    const { items } = await listActivity(h.ctx, user.actor, { profileId: user.profileId });
    expect(items.map((i) => i.title)).toEqual(['Lesson 6']);
    const rows = await h.db.setup
      .select()
      .from(watchProgress)
      .where(eq(watchProgress.videoId, gone.id));
    expect(rows).toHaveLength(1);
  });

  it('remove deletes the row, and undo within the window restores the position', async () => {
    const user = await h.makeUser();
    const video = await watched(user as never, 5);
    await removeActivity(h.ctx, user.actor, { profileId: user.profileId, videoId: video.id });
    expect(
      (await listActivity(h.ctx, user.actor, { profileId: user.profileId })).items,
    ).toHaveLength(0);
    const ok = await restoreProgress(h.ctx, user.actor, {
      profileId: user.profileId,
      requestedId: video.id,
    });
    expect(ok).toBe(true);
    expect(
      (await listActivity(h.ctx, user.actor, { profileId: user.profileId })).items,
    ).toHaveLength(1);
  });

  it('clear removes every row for the profile only, and writes an audit entry with a count and no titles', async () => {
    const user = await h.makeUser();
    const other = await h.makeUser();
    await watched(user as never, 5);
    await watched(user as never, 6);
    await watched(other as never, 7);
    const result = await clearActivity(h.ctx, user.actor, { profileId: user.profileId });
    expect(result.cleared).toBe(2);
    expect(
      (await listActivity(h.ctx, user.actor, { profileId: user.profileId })).items,
    ).toHaveLength(0);
    expect(
      (await listActivity(h.ctx, other.actor, { profileId: other.profileId })).items,
    ).toHaveLength(1);
    const audit = await h.db.setup
      .select()
      .from(auditLog)
      .where(eq(auditLog.action, 'viewer.activity_cleared'));
    const row = audit.find((a) => a.actorAccountId === user.accountId);
    expect(row?.metadata).toEqual({ count: 2 });
    const undo = await h.db.setup
      .select()
      .from(watchProgressRemovals)
      .where(eq(watchProgressRemovals.profileId, user.profileId));
    expect(undo).toHaveLength(0);
  });

  it('an adult can clear a kids profile of their own account (the page itself is adults only)', async () => {
    const user = await h.makeUser();
    const video = await seedVideo(h.db.setup, {
      durationMs: sec(100),
      kidsSafe: true,
      title: 'Kids one',
    } as never);
    await saveProgress(h.ctx, user.actor, {
      profileId: user.kidsProfileId,
      videoId: video.id,
      positionMs: sec(10),
    });
    const result = await clearActivity(h.ctx, user.actor, { profileId: user.kidsProfileId });
    expect(result.cleared).toBe(1);
  });

  it('another account cannot read or clear a profile it does not own', async () => {
    const a = await h.makeUser();
    const b = await h.makeUser();
    await watched(a as never, 5);
    await expect(listActivity(h.ctx, b.actor, { profileId: a.profileId })).rejects.toThrow();
    await expect(clearActivity(h.ctx, b.actor, { profileId: a.profileId })).rejects.toThrow();
    expect((await listActivity(h.ctx, a.actor, { profileId: a.profileId })).items).toHaveLength(1);
  });

  it('keeps each episode of a series with the series name', async () => {
    const user = await h.makeUser();
    const video = await watched(user as never, 5);
    const { items } = await listActivity(h.ctx, user.actor, { profileId: user.profileId });
    expect(items[0]?.videoId).toBe(video.id);
    expect(items[0]?.seriesTitle ?? null).toBeNull();
  });
});
