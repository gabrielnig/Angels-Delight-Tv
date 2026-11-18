import { eq } from 'drizzle-orm';
import { videos } from '@ad/db';
import { CatalogCache } from '@ad/catalog';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { browse, listBrowseCategories } from './browse';
import { getHome } from './home';
import { saveProgress } from './progress';
import {
  categorize,
  createHarness,
  NOW,
  seedCategory,
  seedVideo,
  type ViewerHarness,
} from './testing';

describe.skipIf(!process.env.TEST_DATABASE_ADMIN_URL)('catalog read cache (M04-S05)', () => {
  let h: ViewerHarness;
  let cache: CatalogCache;

  beforeAll(async () => {
    cache = new CatalogCache();
    h = await createHarness({ catalogCache: cache });
    h.setNow(NOW);
  });
  afterAll(async () => {
    await h?.drop();
  });

  it('answers a repeat browse from memory until the cache is emptied, then shows the change', async () => {
    const user = await h.makeUser();
    const shelf = await seedCategory(h.db.setup, 'Cache shelf');
    const video = await seedVideo(h.db.setup, { title: 'Before' });
    await categorize(h.db.setup, { videoId: video.id }, shelf.id);
    const ask = () =>
      browse(h.ctx, user.actor, { profileId: user.profileId, categorySlug: shelf.slug });

    expect((await ask()).items[0]?.title).toBe('Before');
    await h.db.setup.update(videos).set({ title: 'After' }).where(eq(videos.id, video.id));
    expect((await ask()).items[0]?.title).toBe('Before');
    cache.invalidate();
    expect((await ask()).items[0]?.title).toBe('After');
  });

  it('keeps personal data out of the cache: two profiles see their own progress on shared cards', async () => {
    const a = await h.makeUser();
    const b = await h.makeUser();
    const shelf = await seedCategory(h.db.setup, 'Personal shelf');
    const video = await seedVideo(h.db.setup, { title: 'Shared', durationMs: 100_000 });
    await categorize(h.db.setup, { videoId: video.id }, shelf.id);
    await saveProgress(h.ctx, a.actor, {
      profileId: a.profileId,
      videoId: video.id,
      positionMs: 40_000,
    });
    const seenByA = await browse(h.ctx, a.actor, {
      profileId: a.profileId,
      categorySlug: shelf.slug,
    });
    const seenByB = await browse(h.ctx, b.actor, {
      profileId: b.profileId,
      categorySlug: shelf.slug,
    });
    expect(seenByA.items[0]?.progress).toMatchObject({ positionMs: 40_000 });
    expect(seenByB.items[0]?.progress ?? null).toBeNull();
  });

  it('does not let a kids profile share entries with an adult profile', async () => {
    const user = await h.makeUser();
    const shelf = await seedCategory(h.db.setup, 'Audience shelf');
    const open = await seedVideo(h.db.setup, { title: 'Grown up only', kidsSafe: false });
    await categorize(h.db.setup, { videoId: open.id }, shelf.id);
    const adult = await browse(h.ctx, user.actor, {
      profileId: user.profileId,
      categorySlug: shelf.slug,
    });
    const kids = await browse(h.ctx, user.actor, {
      profileId: user.kidsProfileId,
      categorySlug: shelf.slug,
    });
    expect(adult.items.map((i) => i.title)).toEqual(['Grown up only']);
    expect(kids.items).toEqual([]);
    const adultCats = await listBrowseCategories(h.ctx, user.actor, { profileId: user.profileId });
    const kidsCats = await listBrowseCategories(h.ctx, user.actor, {
      profileId: user.kidsProfileId,
    });
    expect(adultCats.some((c) => c.slug === shelf.slug)).toBe(true);
    expect(kidsCats.some((c) => c.slug === shelf.slug)).toBe(false);
  });

  it('caches home rows but still builds the personal rows fresh', async () => {
    const user = await h.makeUser();
    const video = await seedVideo(h.db.setup, { title: 'Home video', durationMs: 100_000 });
    await getHome(h.ctx, user.actor, { profileId: user.profileId });
    await saveProgress(h.ctx, user.actor, {
      profileId: user.profileId,
      videoId: video.id,
      positionMs: 30_000,
    });
    const home = await getHome(h.ctx, user.actor, { profileId: user.profileId });
    const continueRow = home.rows.find((r) => r.kind === 'continue_watching');
    expect(
      continueRow?.kind === 'continue_watching' && continueRow.items.map((i) => i.video.title),
    ).toContain('Home video');
  });
});
