import { schema } from '@ad/db';
import { eq } from 'drizzle-orm';
import { uuidv7, type Actor } from '@ad/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { listPublishedRows, resolveRow } from '../rows';
import { setAdminEpisode } from './series';
import {
  createViewerTestDb,
  integrationEnabled,
  seedAccount,
  seedCategory,
  seedSeries,
  seedVideo,
  type ViewerTestDb,
} from '../testing';
import {
  getAdminHome,
  hasPublishedHome,
  launchHomeConfig,
  publishAdminHome,
  restorePreviousAdminHome,
  saveAdminHomeDraft,
  type HomeConfig,
} from './home';
import type { AdminContext } from './types';

const row = (id: string, type: HomeConfig['rows'][number]['type'], name: string, extra = {}) => ({
  id,
  type,
  name,
  visible: true,
  videoIds: [] as string[],
  sourceId: null as string | null,
  ...extra,
});

describe.skipIf(!integrationEnabled())('admin home curation', () => {
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

  const published = () => t.setup.transaction((tx) => listPublishedRows(tx, { kids: false }));

  it('starts from the built in default when nothing is curated, and refuses viewers', async () => {
    const home = await getAdminHome(ctx, editor);
    expect(home.state.published.rows.map((r) => r.type)).toEqual([
      'continue_watching',
      'my_list',
      'newest',
      'smart',
    ]);
    expect(home.state.publishedAt).toBeNull();
    expect(home.state.previous).toBeNull();
    await expect(getAdminHome(ctx, viewer)).rejects.toThrow();
  });

  it('validates before saving', async () => {
    const tooMany = {
      heroIds: [],
      rows: Array.from({ length: 13 }, (_, i) => row(`r${i}`, 'newest', `Row ${i}`)),
    };
    expect(await saveAdminHomeDraft(ctx, editor, tooMany)).toEqual({
      ok: false,
      error: 'Home can have up to 12 sections.',
    });
    expect(
      await saveAdminHomeDraft(ctx, editor, { heroIds: [], rows: [row('a', 'newest', ' ')] }),
    ).toEqual({ ok: false, error: 'Give the section a name' });
    expect(
      await saveAdminHomeDraft(ctx, editor, { heroIds: ['1', '2', '3', '4', '5', '6'], rows: [] }),
    ).toEqual({ ok: false, error: 'Choose up to 5 hero titles.' });
  });

  it('saves a draft without touching what viewers see', async () => {
    const before = await published();
    const draft = { heroIds: [], rows: [row('draft_row', 'newest', 'Only a draft')] };
    expect(await saveAdminHomeDraft(ctx, editor, draft)).toEqual({ ok: true });
    expect((await getAdminHome(ctx, editor)).state.draft.rows[0]?.name).toBe('Only a draft');
    expect(await published()).toEqual(before);
  });

  it('publishes hero and every row kind into the rows viewers read, in order', async () => {
    const a = await seedVideo(t.setup, { title: 'Alpha' });
    const b = await seedVideo(t.setup, { title: 'Beta' });
    const cat = await seedCategory(t.setup, 'Home science');
    const course = await seedSeries(t.setup, { seasonSizes: [2] });
    const config: HomeConfig = {
      heroIds: [b.id, a.id],
      rows: [
        row('row_continue', 'continue_watching', 'Pick up where you left'),
        row('picks', 'manual', 'Editor picks', { videoIds: [a.id, b.id, uuidv7()] }),
        row('by_cat', 'category', 'Science', { sourceId: cat.id }),
        row('fresh', 'newest', 'New this week'),
        row('course_row', 'series', 'The course', { sourceId: course.id }),
        row('hot', 'smart', 'Most watched', { visible: false }),
        row('mine', 'my_list', 'My List'),
      ],
    };
    expect(await publishAdminHome(ctx, editor, config)).toEqual({ ok: true });

    const rows = await published();
    expect(rows.map((r) => [r.title, r.kind])).toEqual([
      ['Featured', 'hero'],
      ['Pick up where you left', 'continue_watching'],
      ['Editor picks', 'curated'],
      ['Science', 'category'],
      ['New this week', 'recently_added'],
      ['The course', 'curated'],
      ['My List', 'my_list'],
    ]);
    expect(rows[3]?.categorySlug).toBe(cat.slug);

    const items = await t.setup
      .select()
      .from(schema.rowItems)
      .innerJoin(
        schema.rows,
        (await import('drizzle-orm')).eq(schema.rows.id, schema.rowItems.rowId),
      )
      .orderBy(schema.rows.position, schema.rowItems.position);
    const byRow = (title: string) =>
      items.filter((i) => i.rows.title === title).map((i) => i.row_items.videoId);
    expect(byRow('Featured')).toEqual([b.id, a.id]);
    expect(byRow('Editor picks')).toEqual([a.id, b.id]); // the unknown id is dropped
    // A series row is not a copy: it carries the series id and is read from the episodes each time.
    expect(byRow('The course')).toEqual([]);
    expect(rows[5]?.seriesId).toBe(course.id);

    const hidden = await t.setup.select().from(schema.rows);
    expect(hidden.find((r) => r.title === 'Most watched')?.isPublished).toBe(false);

    const home = await getAdminHome(ctx, editor);
    expect(home.state.published.rows.map((r) => r.id)).toEqual(config.rows.map((r) => r.id));
    expect(home.state.draft).toEqual(home.state.published);
    expect(home.state.publishedAt).not.toBeNull();
  });

  it('keeps the earlier version and restores it, swapping the two', async () => {
    const first = (await getAdminHome(ctx, editor)).state.published;
    const second: HomeConfig = { heroIds: [], rows: [row('only', 'newest', 'Just newest')] };
    expect(await publishAdminHome(ctx, editor, second)).toEqual({ ok: true });
    expect((await published()).map((r) => r.title)).toEqual(['Just newest']);
    expect((await getAdminHome(ctx, editor)).state.previous).toEqual(first);

    expect(await restorePreviousAdminHome(ctx, editor)).toEqual({ ok: true });
    const after = await getAdminHome(ctx, editor);
    expect(after.state.published).toEqual(first);
    expect(after.state.previous).toEqual(second);
    expect((await published()).map((r) => r.title)).toContain('Editor picks');
  });

  it('says so when there is nothing to restore', async () => {
    const fresh = await createViewerTestDb();
    try {
      const actor = {
        accountId: (await seedAccount(fresh.setup, 'editor')).id,
        role: 'editor' as const,
      };
      expect(await restorePreviousAdminHome({ db: fresh.app }, actor)).toEqual({
        ok: false,
        error: 'There is no earlier version to restore.',
      });
    } finally {
      await fresh.drop();
    }
  });

  it('reads a config back from rows that exist but were never curated in the admin', async () => {
    const fresh = await createViewerTestDb();
    try {
      const actor = {
        accountId: (await seedAccount(fresh.setup, 'editor')).id,
        role: 'editor' as const,
      };
      const v = await seedVideo(fresh.setup);
      const [curated] = await fresh.setup
        .insert(schema.rows)
        .values({ title: 'Seeded picks', kind: 'curated', position: 0, isPublished: true })
        .returning();
      await fresh.setup
        .insert(schema.rowItems)
        .values({ rowId: curated!.id, position: 0, videoId: v.id });
      await fresh.setup
        .insert(schema.rows)
        .values({ title: 'Fresh', kind: 'recently_added', position: 1, isPublished: false });
      const state = (await getAdminHome({ db: fresh.app }, actor)).state;
      expect(state.published.rows.map((r) => [r.type, r.name, r.visible])).toEqual([
        ['manual', 'Seeded picks', true],
        ['newest', 'Fresh', false],
      ]);
      expect(state.published.rows[0]?.videoIds).toEqual([v.id]);
    } finally {
      await fresh.drop();
    }
  });

  describe('series rows', () => {
    const ctxNow = { mediaOrigin: 'https://media.test', now: () => new Date('2026-06-15T12:00:00Z') };
    const cardsOf = async (title: string) =>
      t.setup.transaction(async (tx) => {
        const rows = await listPublishedRows(tx, { kids: false });
        const found = rows.find((r) => r.title === title)!;
        return (await resolveRow(tx, ctxNow, { kids: false }, found)).cards.map((c) => c.title);
      });

    it('follows episodes added, removed and reordered without publishing again', async () => {
      const course = await seedSeries(t.setup, { seasonSizes: [2] });
      const config: HomeConfig = {
        heroIds: [],
        rows: [row('follow', 'series', 'Follow the course', { sourceId: course.id })],
      };
      expect(await publishAdminHome(ctx, editor, config)).toEqual({ ok: true });
      expect(await cardsOf('Follow the course')).toEqual(['Episode 1.1', 'Episode 1.2']);

      const extra = await seedVideo(t.setup, { title: 'Bonus lesson' });
      expect(await setAdminEpisode(ctx, editor, extra.id, course.id, 1, 3)).toEqual({ ok: true });
      expect(await cardsOf('Follow the course')).toEqual(['Episode 1.1', 'Episode 1.2', 'Bonus lesson']);

      expect(await setAdminEpisode(ctx, editor, course.episodes[0]!.id, null, null, null)).toEqual({
        ok: true,
      });
      expect(await cardsOf('Follow the course')).toEqual(['Episode 1.2', 'Bonus lesson']);

      expect(await setAdminEpisode(ctx, editor, extra.id, course.id, 1, 1)).toEqual({ ok: true });
      expect(await cardsOf('Follow the course')).toEqual(['Bonus lesson', 'Episode 1.2']);
    });

    it('skips an episode that is unpublished or deleted and shows it again when it returns', async () => {
      const course = await seedSeries(t.setup, { seasonSizes: [3] });
      await publishAdminHome(ctx, editor, {
        heroIds: [],
        rows: [row('skip', 'series', 'Skip the hidden', { sourceId: course.id })],
      });
      const middle = course.episodes[1]!.id;
      await t.setup.update(schema.videos).set({ deletedAt: new Date() }).where(eq(schema.videos.id, middle));
      expect(await cardsOf('Skip the hidden')).toEqual(['Episode 1.1', 'Episode 1.3']);
      await t.setup.update(schema.videos).set({ deletedAt: null }).where(eq(schema.videos.id, middle));
      expect(await cardsOf('Skip the hidden')).toEqual(['Episode 1.1', 'Episode 1.2', 'Episode 1.3']);
    });

    it('shows an empty row, not an error, when the series is gone', async () => {
      const course = await seedSeries(t.setup, { seasonSizes: [1] });
      await publishAdminHome(ctx, editor, {
        heroIds: [],
        rows: [row('gone', 'series', 'Gone series', { sourceId: course.id })],
      });
      await t.setup.delete(schema.series).where(eq(schema.series.id, course.id));
      expect(await cardsOf('Gone series')).toEqual([]);
    });

    it('reads a series row back into the editor config with its source', async () => {
      const course = await seedSeries(t.setup, { seasonSizes: [1] });
      await publishAdminHome(ctx, editor, {
        heroIds: [],
        rows: [row('readback', 'series', 'Readback', { sourceId: course.id })],
      });
      const home = await getAdminHome(ctx, editor);
      expect(home.state.published.rows[0]).toMatchObject({ type: 'series', sourceId: course.id });
    });
  });

  it('says whether a home layout was ever published, for the launch tool', async () => {
    const fresh = await createViewerTestDb();
    try {
      const who: Actor = { accountId: (await seedAccount(fresh.setup, 'admin')).id, role: 'admin' };
      const c: AdminContext = { db: fresh.app };
      expect(await hasPublishedHome(c, who)).toBe(false);
      expect((await publishAdminHome(c, who, launchHomeConfig())).ok).toBe(true);
      expect(await hasPublishedHome(c, who)).toBe(true);
      await expect(hasPublishedHome(c, { accountId: who.accountId, role: 'viewer' })).rejects.toThrow();
    } finally {
      await fresh.drop();
    }
  });

  it('writes hero slide text to the hero row and reads it back', async () => {
    const v = await seedVideo(t.setup);
    const config: HomeConfig = {
      heroIds: [v.id],
      heroText: { [v.id]: { headline: 'Start here', buttonLabel: 'Play now' } },
      rows: [],
    };
    expect(await publishAdminHome(ctx, editor, config)).toEqual({ ok: true });
    const [item] = await t.setup
      .select()
      .from(schema.rowItems)
      .where(eq(schema.rowItems.videoId, v.id));
    expect(item?.heroHeadline).toBe('Start here');
    expect(item?.heroBlurb).toBeNull();
    expect(item?.heroButtonLabel).toBe('Play now');
    const home = await getAdminHome(ctx, editor);
    expect(home.state.published.heroText).toEqual({
      [v.id]: { headline: 'Start here', buttonLabel: 'Play now' },
    });
  });

  it('refuses hero text over 80 characters', async () => {
    const r = await publishAdminHome(ctx, editor, {
      heroIds: [],
      heroText: { x: { headline: 'x'.repeat(81) } },
      rows: [],
    });
    expect(r.ok).toBe(false);
  });

  it('publishes the new ranked types and the Popular fallback fields to the rows table', async () => {
    const config: HomeConfig = {
      heroIds: [],
      rows: [
        row('pop', 'smart', 'Popular', { fallbackToNewest: true, fallbackTitle: '  Newly   added ' }),
        row('tr', 'trending', 'Trending now'),
        row('tt', 'top_ten', 'Top 10'),
        row('ml', 'most_liked', 'Most liked'),
      ],
    };
    expect(await publishAdminHome(ctx, editor, config)).toEqual({ ok: true });
    const rows = await published();
    expect(rows.map((r) => r.kind)).toEqual(['popular', 'trending', 'top_ten', 'most_liked']);
    expect(rows[0]).toMatchObject({ fallbackToNewest: true, fallbackTitle: 'Newly added' });
    expect(rows[1]).toMatchObject({ fallbackToNewest: false, fallbackTitle: null });
    expect(rows.map((r) => r.minItems)).toEqual([3, 5, 5, 5]);
  });
});
