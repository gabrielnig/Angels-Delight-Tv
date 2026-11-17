import { eq } from 'drizzle-orm';
import { myList, videos } from '@ad/db';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { addToMyList, listMyList, removeFromMyList } from './my-list';
import { createHarness, NOW, seedSeries, seedVideo, type ViewerHarness } from './testing';

const later = (seconds: number) => new Date(NOW.getTime() + seconds * 1000);

describe.skipIf(!process.env.TEST_DATABASE_ADMIN_URL)('my list', () => {
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
    const add = (id: string, kind: 'video' | 'series' = 'video', profileId = user.profileId) =>
      addToMyList(h.ctx, user.actor, { profileId, target: { kind, id } });
    const list = (profileId = user.profileId, extra = {}) =>
      listMyList(h.ctx, user.actor, { profileId, ...extra });
    return { user, add, list };
  }

  describe('adding', () => {
    it('lists the newest addition first with card details', async () => {
      const { add, list } = await setup();
      const older = await seedVideo(h.db.setup, { title: 'Saved first' });
      const newer = await seedVideo(h.db.setup, { title: 'Saved second' });
      await add(older.id);
      h.setNow(later(10));
      await add(newer.id);

      const page = await list();

      expect(page.items.map((item) => item.card.title)).toEqual(['Saved second', 'Saved first']);
      expect(page.items[0]?.card.inMyList).toBe(true);
    });

    it('is idempotent when the same title is added twice', async () => {
      const { user, add, list } = await setup();
      const video = await seedVideo(h.db.setup);

      await add(video.id);
      h.setNow(later(5));
      await add(video.id);

      expect((await list()).items).toHaveLength(1);
      const rows = await h.db.setup
        .select()
        .from(myList)
        .where(eq(myList.profileId, user.profileId));
      expect(rows).toHaveLength(1);
    });

    it('saves a whole series rather than its episodes', async () => {
      const { add, list } = await setup();
      const series = await seedSeries(h.db.setup, { series: { title: 'Saved series' } });

      await add(series.id, 'series');

      expect((await list()).items.map((item) => `${item.card.kind}:${item.card.title}`)).toEqual([
        'series:Saved series',
      ]);
    });

    it('does not accept an episode on its own', async () => {
      const { add } = await setup();
      const series = await seedSeries(h.db.setup);

      await expect(add(series.episodes[0]!.id)).rejects.toMatchObject({ code: 'not_found' });
    });

    it('answers not found for a title that is not published', async () => {
      const { add } = await setup();
      const draft = await seedVideo(h.db.setup, { publishState: 'draft' });

      await expect(add(draft.id)).rejects.toMatchObject({ code: 'not_found' });
    });

    it('answers not found when a kids profile adds a title that is not kids safe', async () => {
      const { user, add } = await setup();
      const adult = await seedVideo(h.db.setup, { kidsSafe: false });

      await expect(add(adult.id, 'video', user.kidsProfileId)).rejects.toMatchObject({
        code: 'not_found',
      });
    });

    it('stops at the configured capacity', async () => {
      const small = await createHarness({ rules: { maxMyListItems: 2 } });
      try {
        const user = await small.makeUser();
        const add = async (title: string) => {
          const video = await seedVideo(small.db.setup, { title });
          return addToMyList(small.ctx, user.actor, {
            profileId: user.profileId,
            target: { kind: 'video', id: video.id },
          });
        };
        await add('One');
        await add('Two');

        await expect(add('Three')).rejects.toMatchObject({
          code: 'conflict',
          message: 'My List is full',
        });
      } finally {
        await small.drop();
      }
    });
  });

  describe('removing', () => {
    it('removes a title and reports when it had been added', async () => {
      const { add, list, user } = await setup();
      const video = await seedVideo(h.db.setup);
      await add(video.id);

      const removed = await removeFromMyList(h.ctx, user.actor, {
        profileId: user.profileId,
        target: { kind: 'video', id: video.id },
      });

      expect(removed.addedAt).toBe(NOW.toISOString());
      expect((await list()).items).toEqual([]);
    });

    it('puts an undone removal back at its original position', async () => {
      const { add, list, user } = await setup();
      const first = await seedVideo(h.db.setup, { title: 'Original first' });
      const second = await seedVideo(h.db.setup, { title: 'Original second' });
      await add(first.id);
      h.setNow(later(30));
      await add(second.id);
      const removed = await removeFromMyList(h.ctx, user.actor, {
        profileId: user.profileId,
        target: { kind: 'video', id: first.id },
      });
      h.setNow(later(90));

      await addToMyList(h.ctx, user.actor, {
        profileId: user.profileId,
        target: { kind: 'video', id: first.id },
        restoreAddedAt: removed.addedAt!,
      });

      expect((await list()).items.map((item) => item.card.title)).toEqual([
        'Original second',
        'Original first',
      ]);
    });

    it('succeeds quietly for a title that was not in the list', async () => {
      const { user } = await setup();
      const video = await seedVideo(h.db.setup);

      const removed = await removeFromMyList(h.ctx, user.actor, {
        profileId: user.profileId,
        target: { kind: 'video', id: video.id },
      });

      expect(removed).toEqual({ inList: false, addedAt: null });
    });
  });

  describe('visibility', () => {
    it('hides an unpublished title but keeps it stored and shows it again when republished', async () => {
      const { add, list, user } = await setup();
      const video = await seedVideo(h.db.setup, { title: 'Comes and goes' });
      await add(video.id);

      await h.db.setup
        .update(videos)
        .set({ publishState: 'unpublished' })
        .where(eq(videos.id, video.id));
      expect((await list()).items).toEqual([]);
      expect(
        await h.db.setup.select().from(myList).where(eq(myList.profileId, user.profileId)),
      ).toHaveLength(1);

      await h.db.setup
        .update(videos)
        .set({ publishState: 'published' })
        .where(eq(videos.id, video.id));
      expect((await list()).items).toHaveLength(1);
    });

    it('hides titles that stop being kids safe from a kids profile at once', async () => {
      const { add, list, user } = await setup();
      const video = await seedVideo(h.db.setup, { kidsSafe: true });
      await add(video.id, 'video', user.kidsProfileId);
      expect((await list(user.kidsProfileId)).items).toHaveLength(1);

      await h.db.setup.update(videos).set({ kidsSafe: false }).where(eq(videos.id, video.id));

      expect((await list(user.kidsProfileId)).items).toEqual([]);
    });

    it('shows only kids safe titles on a kids profile even if the list holds others', async () => {
      const { user, list } = await setup();
      const adult = await seedVideo(h.db.setup, { title: 'Adult saved', kidsSafe: false });
      const child = await seedVideo(h.db.setup, { title: 'Child saved', kidsSafe: true });
      await h.db.setup.insert(myList).values([
        { profileId: user.kidsProfileId, videoId: adult.id },
        { profileId: user.kidsProfileId, videoId: child.id },
      ]);

      expect((await list(user.kidsProfileId)).items.map((item) => item.card.title)).toEqual([
        'Child saved',
      ]);
    });
  });

  describe('paging and separation', () => {
    it('pages 24 at a time by cursor', async () => {
      const { add, list } = await setup();
      for (let i = 0; i < 26; i++) {
        const video = await seedVideo(h.db.setup, { title: `Bulk ${i}` });
        h.setNow(later(i));
        await add(video.id);
      }

      const first = await list();
      const second = await list(undefined, { cursor: first.nextCursor! });

      expect(first.items).toHaveLength(24);
      expect(second.items).toHaveLength(2);
      expect(second.nextCursor).toBeNull();
      expect(new Set([...first.items, ...second.items].map((item) => item.card.id)).size).toBe(26);
    });

    it('keeps each profile list to itself', async () => {
      const { user, add, list } = await setup();
      const video = await seedVideo(h.db.setup, { kidsSafe: true });
      await add(video.id, 'video', user.profileId);

      expect((await list(user.kidsProfileId)).items).toEqual([]);
    });

    it('answers not found for a profile of another account and writes nothing', async () => {
      const owner = await setup();
      const stranger = await h.makeUser();
      const video = await seedVideo(h.db.setup);

      await expect(
        addToMyList(h.ctx, stranger.actor, {
          profileId: owner.user.profileId,
          target: { kind: 'video', id: video.id },
        }),
      ).rejects.toMatchObject({ code: 'not_found' });
      await expect(
        listMyList(h.ctx, stranger.actor, { profileId: owner.user.profileId }),
      ).rejects.toMatchObject({ code: 'not_found' });
      await expect(
        removeFromMyList(h.ctx, stranger.actor, {
          profileId: owner.user.profileId,
          target: { kind: 'video', id: video.id },
        }),
      ).rejects.toMatchObject({ code: 'not_found' });
      expect(await h.db.setup.select().from(myList).where(eq(myList.videoId, video.id))).toEqual(
        [],
      );
    });

    it('does not let removal reach another profile through a guessed video id', async () => {
      const owner = await setup();
      const stranger = await setup();
      const video = await seedVideo(h.db.setup);
      await owner.add(video.id);

      await removeFromMyList(h.ctx, stranger.user.actor, {
        profileId: stranger.user.profileId,
        target: { kind: 'video', id: video.id },
      });

      expect((await owner.list()).items).toHaveLength(1);
    });

    it('rejects a cursor that was not issued by the service', async () => {
      const { list } = await setup();

      await expect(list(undefined, { cursor: 'junk' })).rejects.toMatchObject({
        code: 'validation_failed',
      });
    });
  });
});
