import { uuidv7, type Actor } from '@ad/shared';
import { asRole } from '@ad/db/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { browse, listBrowseCategories } from './browse';
import { getHome } from './home';
import { addToMyList, listMyList, removeFromMyList } from './my-list';
import { continueWatching, getProgress, removeProgress, saveProgress } from './progress';
import { selectProfile, updateProfile, deleteProfile } from './profiles';
import {
  clearRecentSearches,
  getRecentSearches,
  removeRecentSearch,
  search,
  suggest,
} from './search';
import { getTitleDetail } from './title-detail';
import type { ViewerContext } from './context';
import {
  categorize,
  createHarness,
  NOW,
  seedCategory,
  seedSeries,
  seedVideo,
  type ViewerHarness,
} from './testing';

type ProfileScoped = [
  string,
  (ctx: ViewerContext, actor: Actor, profileId: string) => Promise<unknown>,
];

describe.skipIf(!process.env.TEST_DATABASE_ADMIN_URL)('viewer API security', () => {
  let h: ViewerHarness;
  let video: { id: string; slug: string };

  beforeAll(async () => {
    h = await createHarness();
    h.setNow(NOW);
    video = await seedVideo(h.db.setup, { kidsSafe: true });
  });
  afterAll(async () => {
    await h?.drop();
  });

  const scoped = (): ProfileScoped[] => [
    ['getHome', (c, a, p) => getHome(c, a, { profileId: p })],
    ['browse', (c, a, p) => browse(c, a, { profileId: p, sort: 'newest' })],
    ['listBrowseCategories', (c, a, p) => listBrowseCategories(c, a, { profileId: p })],
    ['search', (c, a, p) => search(c, a, { profileId: p, query: 'sample' })],
    ['suggest', (c, a, p) => suggest(c, a, { profileId: p, query: 'sample' })],
    ['getRecentSearches', (c, a, p) => getRecentSearches(c, a, { profileId: p })],
    [
      'removeRecentSearch',
      (c, a, p) => removeRecentSearch(c, a, { profileId: p, query: 'sample' }),
    ],
    ['clearRecentSearches', (c, a, p) => clearRecentSearches(c, a, { profileId: p })],
    ['getTitleDetail', (c, a, p) => getTitleDetail(c, a, { profileId: p, id: video.id })],
    ['getProgress', (c, a, p) => getProgress(c, a, { profileId: p, videoId: video.id })],
    [
      'saveProgress',
      (c, a, p) => saveProgress(c, a, { profileId: p, videoId: video.id, positionMs: 30_000 }),
    ],
    ['removeProgress', (c, a, p) => removeProgress(c, a, { profileId: p, videoId: video.id })],
    ['continueWatching', (c, a, p) => continueWatching(c, a, { profileId: p })],
    ['listMyList', (c, a, p) => listMyList(c, a, { profileId: p })],
    [
      'addToMyList',
      (c, a, p) => addToMyList(c, a, { profileId: p, target: { kind: 'video', id: video.id } }),
    ],
    [
      'removeFromMyList',
      (c, a, p) =>
        removeFromMyList(c, a, { profileId: p, target: { kind: 'video', id: video.id } }),
    ],
    ['selectProfile', (c, a, p) => selectProfile(c, a, p)],
    ['updateProfile', (c, a, p) => updateProfile(c, a, p, { avatarId: 'moon' })],
    ['deleteProfile', (c, a, p) => deleteProfile(c, a, p)],
  ];

  describe('profile ownership (IDOR)', () => {
    it.each(scoped().map(([name]) => name))(
      '%s answers not found for another account',
      async (name) => {
        const owner = await h.makeUser();
        const stranger = await h.makeUser();
        const call = scoped().find(([candidate]) => candidate === name)![1];

        await expect(call(h.ctx, stranger.actor, owner.profileId)).rejects.toMatchObject({
          code: 'not_found',
        });
        await expect(call(h.ctx, stranger.actor, owner.kidsProfileId)).rejects.toMatchObject({
          code: 'not_found',
        });
      },
    );

    it.each(scoped().map(([name]) => name))(
      '%s answers not found for an admin of another account',
      async (name) => {
        const owner = await h.makeUser();
        const admin = await h.makeUser('admin');
        const call = scoped().find(([candidate]) => candidate === name)![1];

        await expect(call(h.ctx, admin.actor, owner.profileId)).rejects.toMatchObject({
          code: 'not_found',
        });
      },
    );

    it.each(scoped().map(([name]) => name))(
      '%s answers not found for unknown and malformed ids',
      async (name) => {
        const user = await h.makeUser();
        const call = scoped().find(([candidate]) => candidate === name)![1];

        await expect(call(h.ctx, user.actor, uuidv7())).rejects.toMatchObject({
          code: 'not_found',
        });
        await expect(call(h.ctx, user.actor, "x'; DROP TABLE profiles; --")).rejects.toMatchObject({
          code: 'not_found',
        });
      },
    );

    it('leaves the owner data untouched after a stranger tried every write', async () => {
      const owner = await h.makeUser();
      const stranger = await h.makeUser();
      await saveProgress(h.ctx, owner.actor, {
        profileId: owner.profileId,
        videoId: video.id,
        positionMs: 30_000,
      });
      await addToMyList(h.ctx, owner.actor, {
        profileId: owner.profileId,
        target: { kind: 'video', id: video.id },
      });

      for (const [, call] of scoped()) {
        await call(h.ctx, stranger.actor, owner.profileId).catch(() => undefined);
      }

      expect(
        (await getProgress(h.ctx, owner.actor, { profileId: owner.profileId, videoId: video.id }))
          ?.positionMs,
      ).toBe(30_000);
      expect(
        (await listMyList(h.ctx, owner.actor, { profileId: owner.profileId })).items,
      ).toHaveLength(1);
    });
  });

  describe('row level security under the app role', () => {
    it('hides another account search history, watch progress and list from direct queries', async () => {
      const owner = await h.makeUser();
      const stranger = await h.makeUser();
      await search(h.ctx, owner.actor, {
        profileId: owner.profileId,
        query: 'secret topic',
        record: true,
      });
      await saveProgress(h.ctx, owner.actor, {
        profileId: owner.profileId,
        videoId: video.id,
        positionMs: 30_000,
      });
      await addToMyList(h.ctx, owner.actor, {
        profileId: owner.profileId,
        target: { kind: 'video', id: video.id },
      });

      for (const table of ['search_history', 'watch_progress', 'my_list']) {
        const seenByStranger = await asRole(
          h.db.admin.pool,
          'ad_app',
          { accountId: stranger.accountId, actorRole: 'viewer' },
          (client) =>
            client.query(`SELECT count(*)::int AS n FROM ${table} WHERE profile_id = $1`, [
              owner.profileId,
            ]),
        );
        const seenByOwner = await asRole(
          h.db.admin.pool,
          'ad_app',
          { accountId: owner.accountId, actorRole: 'viewer' },
          (client) =>
            client.query(`SELECT count(*)::int AS n FROM ${table} WHERE profile_id = $1`, [
              owner.profileId,
            ]),
        );
        expect(seenByStranger.rows[0].n, table).toBe(0);
        expect(seenByOwner.rows[0].n, table).toBeGreaterThan(0);
      }
    });

    it('refuses to write search history for a profile of another account', async () => {
      const owner = await h.makeUser();
      const stranger = await h.makeUser();

      await expect(
        asRole(
          h.db.admin.pool,
          'ad_app',
          { accountId: stranger.accountId, actorRole: 'viewer' },
          (client) =>
            client.query("INSERT INTO search_history (profile_id, query) VALUES ($1, 'planted')", [
              owner.profileId,
            ]),
        ),
      ).rejects.toThrow(/row-level security/);
    });

    it('shows no search history when no account context is set', async () => {
      const owner = await h.makeUser();
      await search(h.ctx, owner.actor, {
        profileId: owner.profileId,
        query: 'context free',
        record: true,
      });

      const rows = await asRole(h.db.admin.pool, 'ad_app', {}, (client) =>
        client.query('SELECT count(*)::int AS n FROM search_history'),
      );

      expect(rows.rows[0].n).toBe(0);
    });
  });

  describe('kids profile filtering is enforced by the queries', () => {
    it('never returns a title that is not kids safe from any list, whatever the request', async () => {
      const user = await h.makeUser();
      const shelf = await seedCategory(h.db.setup, 'Matrix shelf');
      const adult = await seedVideo(h.db.setup, { title: 'Matrix adult title', kidsSafe: false });
      const adultSeries = await seedSeries(h.db.setup, {
        series: { title: 'Matrix adult series', kidsSafe: false },
      });
      const child = await seedVideo(h.db.setup, { title: 'Matrix child title', kidsSafe: true });
      for (const ref of [
        { videoId: adult.id },
        { videoId: child.id },
        { seriesId: adultSeries.id },
      ]) {
        await categorize(h.db.setup, ref, shelf.id);
      }
      const kid = user.kidsProfileId;
      const titles = (list: { title: string }[]) => list.map((item) => item.title);

      const home = await getHome(h.ctx, user.actor, { profileId: kid });
      const browsed = await browse(h.ctx, user.actor, {
        profileId: kid,
        categorySlug: shelf.slug,
        sort: 'newest',
      });
      const found = await search(h.ctx, user.actor, { profileId: kid, query: 'matrix' });
      const suggestions = await suggest(h.ctx, user.actor, { profileId: kid, query: 'matrix' });
      const related = await getTitleDetail(h.ctx, user.actor, { profileId: kid, id: child.id });

      const everyTitle = [
        ...titles(home.hero.map((item) => item.card)),
        ...home.rows.flatMap((row) => (row.kind === 'continue_watching' ? [] : titles(row.items))),
        ...titles(browsed.items),
        ...titles(found.items),
        ...titles(found.popular),
        ...suggestions.map((s) => s.label),
        ...(related.type === 'video' ? titles(related.related) : []),
      ];
      expect(everyTitle.filter((title) => title.includes('adult'))).toEqual([]);
      expect(everyTitle).toContain('Matrix child title');
      await expect(
        getTitleDetail(h.ctx, user.actor, { profileId: kid, id: adult.id }),
      ).rejects.toMatchObject({ code: 'not_found' });
      await expect(
        addToMyList(h.ctx, user.actor, { profileId: kid, target: { kind: 'video', id: adult.id } }),
      ).rejects.toMatchObject({ code: 'not_found' });
      await expect(
        saveProgress(h.ctx, user.actor, { profileId: kid, videoId: adult.id, positionMs: 30_000 }),
      ).rejects.toMatchObject({ code: 'not_found' });
    });
  });
});
