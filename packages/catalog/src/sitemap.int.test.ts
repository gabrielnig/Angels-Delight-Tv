import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { slugRedirects, videos } from '@ad/db';
import { uuidv7 } from '@ad/shared';
import { isKidsOnlyTitle, listSitemapRows } from './sitemap';
import {
  FUTURE,
  NOW,
  PAST,
  categorize,
  createViewerTestDb,
  integrationEnabled,
  seedCategory,
  seedSeries,
  seedVideo,
  type ViewerTestDb,
} from './testing';

describe.skipIf(!integrationEnabled())('sitemap rows (M45-S01)', () => {
  let t: ViewerTestDb;
  beforeAll(async () => {
    t = await createViewerTestDb();
  });
  afterAll(async () => {
    await t?.drop();
  });

  const slugs = async () => (await listSitemapRows(t.app, NOW)).videos.map((v) => v.slug);

  it('lists only published titles', async () => {
    const live = await seedVideo(t.setup);
    const draft = await seedVideo(t.setup, { publishState: 'draft' });
    const found = await slugs();
    expect(found).toContain(live.slug);
    expect(found).not.toContain(draft.slug);
  });

  it('omits unpublished, trashed and scheduled titles', async () => {
    const unpublished = await seedVideo(t.setup, { publishState: 'unpublished' });
    const trashed = await seedVideo(t.setup, { deletedAt: PAST });
    const scheduled = await seedVideo(t.setup, { publishState: 'scheduled', publishAt: FUTURE });
    const due = await seedVideo(t.setup, { publishState: 'scheduled', publishAt: PAST });
    const found = await slugs();
    for (const hidden of [unpublished, trashed, scheduled])
      expect(found).not.toContain(hidden.slug);
    expect(found).toContain(due.slug);
  });

  it('unpublishing a title removes it from the next build', async () => {
    const video = await seedVideo(t.setup);
    expect(await slugs()).toContain(video.slug);
    await t.setup
      .update(videos)
      .set({ publishState: 'unpublished' })
      .where(eq(videos.id, video.id));
    expect(await slugs()).not.toContain(video.slug);
  });

  it('omits kids only titles (R26) but keeps titles that are for everyone', async () => {
    const kidsOnly = await seedVideo(t.setup, { suitability: 'kids', kidsSafe: true });
    const legacyKids = await seedVideo(t.setup, { suitability: null, kidsSafe: true });
    const everyone = await seedVideo(t.setup, { suitability: 'everyone', kidsSafe: true });
    const found = await slugs();
    expect(found).not.toContain(kidsOnly.slug);
    expect(found).not.toContain(legacyKids.slug);
    expect(found).toContain(everyone.slug);
  });

  it('omits episodes, which live on their series page', async () => {
    const s = await seedSeries(t.setup);
    const rows = await listSitemapRows(t.app, NOW);
    expect(rows.series.map((x) => x.slug)).toContain(s.slug);
    const episodeSlugs = await t.setup
      .select({ slug: videos.slug })
      .from(videos)
      .where(eq(videos.kind, 'episode'));
    for (const e of episodeSlugs) expect(rows.videos.map((v) => v.slug)).not.toContain(e.slug);
  });

  it('takes series lastmod from the newest change in the series or its episodes', async () => {
    const s = await seedSeries(t.setup, { series: { title: 'lastmod series' } });
    const newer = new Date('2026-06-10T00:00:00Z');
    await t.setup.update(videos).set({ updatedAt: newer }).where(eq(videos.id, s.episodes[0]!.id));
    const row = (await listSitemapRows(t.app, NOW)).series.find((x) => x.slug === s.slug);
    expect(row?.lastmod.getTime()).toBeGreaterThanOrEqual(newer.getTime());
  });

  it('lists visible categories that have a public title, and skips hidden or empty ones', async () => {
    const used = await seedCategory(t.setup, 'Sitemap used');
    const hidden = await seedCategory(t.setup, 'Sitemap hidden', { isVisible: false });
    const empty = await seedCategory(t.setup, 'Sitemap empty');
    const video = await seedVideo(t.setup);
    await categorize(t.setup, { videoId: video.id }, used.id);
    await categorize(t.setup, { videoId: video.id }, hidden.id);
    const found = (await listSitemapRows(t.app, NOW)).categories.map((c) => c.slug);
    expect(found).toContain(used.slug);
    expect(found).not.toContain(hidden.slug);
    expect(found).not.toContain(empty.slug);
  });

  it('never lists a slug that only exists as a redirect', async () => {
    const video = await seedVideo(t.setup);
    await t.setup
      .insert(slugRedirects)
      .values({ id: uuidv7(), oldSlug: 'old-name-for-it', videoId: video.id });
    expect(await slugs()).not.toContain('old-name-for-it');
  });
});

describe.skipIf(!integrationEnabled())('isKidsOnlyTitle (R26)', () => {
  let t: ViewerTestDb;
  beforeAll(async () => {
    t = await createViewerTestDb();
  });
  afterAll(async () => {
    await t?.drop();
  });

  it('is true for a kids only video and false for one that is for everyone', async () => {
    const kidsOnly = await seedVideo(t.setup, { suitability: 'kids', kidsSafe: true });
    const everyone = await seedVideo(t.setup, { suitability: 'everyone', kidsSafe: true });
    const adults = await seedVideo(t.setup);
    expect(await isKidsOnlyTitle(t.app, 'video', kidsOnly.slug)).toBe(true);
    expect(await isKidsOnlyTitle(t.app, 'video', everyone.slug)).toBe(false);
    expect(await isKidsOnlyTitle(t.app, 'video', adults.slug)).toBe(false);
  });

  it('treats an older row with the kids flag and no suitability as kids only', async () => {
    const legacy = await seedVideo(t.setup, { suitability: null, kidsSafe: true });
    expect(await isKidsOnlyTitle(t.app, 'video', legacy.slug)).toBe(true);
  });

  it('is true for a series whose live episodes are all kids only, false when one is not', async () => {
    const kidsSeries = await seedSeries(t.setup, {
      episode: { suitability: 'kids', kidsSafe: true },
    });
    const mixed = await seedSeries(t.setup, { seasonSizes: [2] });
    await t.setup
      .update(videos)
      .set({ suitability: 'kids', kidsSafe: true })
      .where(eq(videos.id, mixed.episodes[0]!.id));
    expect(await isKidsOnlyTitle(t.app, 'series', kidsSeries.slug)).toBe(true);
    expect(await isKidsOnlyTitle(t.app, 'series', mixed.slug)).toBe(false);
  });

  it('is false for a slug that does not exist', async () => {
    expect(await isKidsOnlyTitle(t.app, 'video', 'no-such-thing')).toBe(false);
  });
});
