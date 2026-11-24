import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { slugRedirects, videos } from '@ad/db';
import { uuidv7 } from '@ad/shared';
import { listSitemapRows } from './sitemap';
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
