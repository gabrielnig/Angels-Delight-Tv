import {
  createHarness,
  integrationEnabled,
  NOW,
  seedSeries,
  seedVideo,
  type ViewerHarness,
} from '@ad/viewer/testing';
import { saveProgress } from '@ad/viewer';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { ViewerContext } from '../../lib/data/types';
import { RealLibrary } from './real-library';

type User = Awaited<ReturnType<ViewerHarness['makeUser']>>;
const adult = (u: User): ViewerContext => ({
  accountId: u.accountId,
  profileId: u.profileId,
  audience: 'adult',
});
const kids = (u: User): ViewerContext => ({
  accountId: u.accountId,
  profileId: u.kidsProfileId,
  audience: 'kids',
});

describe.skipIf(!integrationEnabled())('real library repository', () => {
  let h: ViewerHarness;
  let lib: RealLibrary;

  beforeAll(async () => {
    h = await createHarness();
    lib = new RealLibrary(h.ctx);
  });
  afterAll(async () => {
    await h?.drop();
  });
  const later = (seconds: number) => new Date(NOW.getTime() + seconds * 1000);

  describe('my list', () => {
    it('adds and removes by key, newest first, with counts and ids', async () => {
      const u = await h.makeUser();
      const a = await seedVideo(h.db.setup, { title: 'Saved A', kidsSafe: true });
      const b = await seedVideo(h.db.setup, { title: 'Saved B', kidsSafe: true });
      const s = await seedSeries(h.db.setup, {
        series: { title: 'Saved series', kidsSafe: true },
        episode: { kidsSafe: true },
      });
      await lib.addToList(adult(u), `video:${a.id}`);
      h.setNow(later(5));
      await lib.addToList(adult(u), `video:${b.id}`);
      h.setNow(later(10));
      await lib.addToList(adult(u), `series:${s.id}`);

      const page = await lib.myList(adult(u));
      expect(page.items.map((i) => i.title)).toEqual(['Saved series', 'Saved B', 'Saved A']);
      expect(page.total).toBe(3);
      expect(page.hiddenCount).toBe(0);
      expect(page.nextCursor).toBeNull();
      expect(page.items[0]).toMatchObject({ kind: 'series', id: s.id });
      expect((await lib.myListIds(adult(u))).sort()).toEqual(
        [`video:${a.id}`, `video:${b.id}`, `series:${s.id}`].sort(),
      );

      await lib.removeFromList(adult(u), `video:${b.id}`);
      expect((await lib.myList(adult(u))).items.map((i) => i.title)).toEqual([
        'Saved series',
        'Saved A',
      ]);
      await lib.removeFromList(adult(u), `video:${b.id}`);
    });

    it('is separate per profile and hides grown-up titles from kids without losing them', async () => {
      const u = await h.makeUser();
      const safe = await seedVideo(h.db.setup, { title: 'Safe', kidsSafe: true });
      const grown = await seedVideo(h.db.setup, { title: 'Grown', kidsSafe: false });
      await lib.addToList(adult(u), `video:${safe.id}`);
      await lib.addToList(adult(u), `video:${grown.id}`);
      expect((await lib.myList(kids(u))).total).toBe(0);
      await lib.addToList(kids(u), `video:${safe.id}`);
      await expect(lib.addToList(kids(u), `video:${grown.id}`)).rejects.toThrow();
      const asKids = await lib.myList(kids(u));
      expect(asKids.items.map((i) => i.title)).toEqual(['Safe']);
      expect(asKids.hiddenCount).toBe(0);
      expect((await lib.myList(adult(u))).total).toBe(2);
    });

    it('counts hidden items for a kids profile that holds a title that became unsafe', async () => {
      const u = await h.makeUser();
      const v = await seedVideo(h.db.setup, { title: 'Was safe', kidsSafe: true });
      await lib.addToList(kids(u), `video:${v.id}`);
      const { videos } = await import('@ad/db');
      const { eq } = await import('drizzle-orm');
      await h.db.setup.update(videos).set({ kidsSafe: false }).where(eq(videos.id, v.id));
      const page = await lib.myList(kids(u));
      expect(page).toMatchObject({ total: 0, hiddenCount: 1 });
    });

    it('pages with a cursor', async () => {
      const u = await h.makeUser();
      for (let i = 0; i < 14; i++) {
        const v = await seedVideo(h.db.setup, { title: `Paged ${i}` });
        h.setNow(later(i));
        await lib.addToList(adult(u), `video:${v.id}`);
      }
      const first = await lib.myList(adult(u));
      expect(first.items).toHaveLength(12);
      expect(first.total).toBe(14);
      const second = await lib.myList(adult(u), first.nextCursor!);
      expect(second.items).toHaveLength(2);
      expect(second.nextCursor).toBeNull();
    });

    it('rejects malformed keys and another account profile', async () => {
      const u = await h.makeUser();
      const other = await h.makeUser();
      await expect(lib.addToList(adult(u), 'nonsense')).rejects.toThrow();
      await expect(lib.addToList(adult(u), 'video:not-a-uuid')).rejects.toThrow();
      const v = await seedVideo(h.db.setup);
      await expect(
        lib.addToList({ ...adult(u), profileId: other.profileId }, `video:${v.id}`),
      ).rejects.toThrow();
    });
  });

  describe('continue watching', () => {
    async function watch(u: User, videoId: string, positionMs: number, at = NOW) {
      h.setNow(at);
      await saveProgress(h.ctx, u.actor, {
        profileId: u.profileId,
        videoId,
        positionMs,
        seek: true,
      });
    }

    it('lists unfinished videos newest first with progress, skipping finished ones', async () => {
      const u = await h.makeUser();
      const one = await seedVideo(h.db.setup, { title: 'Half way', durationMs: 600_000 });
      const two = await seedVideo(h.db.setup, { title: 'Just started', durationMs: 600_000 });
      const done = await seedVideo(h.db.setup, { title: 'Finished', durationMs: 600_000 });
      await watch(u, one.id, 300_000, later(0));
      await watch(u, two.id, 60_000, later(30));
      await watch(u, done.id, 599_000, later(60));
      const rows = await lib.continueWatching(adult(u));
      expect(rows.map((r) => r.video.title)).toEqual(['Just started', 'Half way']);
      expect(rows[1]!.progress).toMatchObject({
        videoId: one.id,
        positionSeconds: 300,
        durationSeconds: 600,
      });
    });

    it('follows a finished episode with the next one', async () => {
      const u = await h.makeUser();
      const s = await seedSeries(h.db.setup, {
        series: { title: 'Next up series' },
        seasonSizes: [3],
        episode: { durationMs: 300_000 },
      });
      await watch(u, s.episodes[0]!.id, 299_000);
      const rows = await lib.continueWatching(adult(u));
      expect(rows).toHaveLength(1);
      expect(rows[0]!.video.id).toBe(s.episodes[1]!.id);
      expect(rows[0]!.video.series).toMatchObject({ season: 1, episode: 2 });
      expect(rows[0]!.progress.positionSeconds).toBe(0);
    });

    it('does not show grown-up titles on a kids profile', async () => {
      const u = await h.makeUser();
      const v = await seedVideo(h.db.setup, { kidsSafe: false, durationMs: 600_000 });
      await watch(u, v.id, 200_000);
      expect(await lib.continueWatching(adult(u))).toHaveLength(1);
      expect(await lib.continueWatching(kids(u))).toHaveLength(0);
    });

    it('removes a row and can restore it where it was', async () => {
      const u = await h.makeUser();
      const v = await seedVideo(h.db.setup, { title: 'Remove me', durationMs: 600_000 });
      await watch(u, v.id, 240_000);
      await lib.removeFromContinue(adult(u), v.id);
      expect(await lib.continueWatching(adult(u))).toHaveLength(0);
      await lib.restoreContinue(adult(u), v.id);
      const rows = await lib.continueWatching(adult(u));
      expect(rows).toHaveLength(1);
      expect(rows[0]!.progress.positionSeconds).toBe(240);
    });

    it('restore without a removal is a no-op and removing twice is fine', async () => {
      const u = await h.makeUser();
      const v = await seedVideo(h.db.setup, { durationMs: 600_000 });
      await lib.restoreContinue(adult(u), v.id);
      await lib.removeFromContinue(adult(u), v.id);
      await lib.removeFromContinue(adult(u), v.id);
      expect(await lib.continueWatching(adult(u))).toEqual([]);
    });

    it('cannot remove progress of another account profile', async () => {
      const u = await h.makeUser();
      const other = await h.makeUser();
      await expect(
        lib.removeFromContinue(
          { ...adult(u), profileId: other.profileId },
          'a0000000-0000-7000-8000-000000000000',
        ),
      ).rejects.toThrow();
    });
  });
});
