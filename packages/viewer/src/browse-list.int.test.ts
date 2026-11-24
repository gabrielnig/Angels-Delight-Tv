import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { browseList } from './browse';
import { guestBrowseList } from './guest';
import { createHarness, NOW, seedVideo, type ViewerHarness } from './testing';

describe.skipIf(!process.env.TEST_DATABASE_ADMIN_URL)('browse list pages', () => {
  let h: ViewerHarness;
  beforeAll(async () => {
    h = await createHarness();
  });
  afterAll(async () => {
    await h?.drop();
  });

  it('lists New newest first and Trending as a page with no cursor', async () => {
    h.setNow(NOW);
    const user = await h.makeUser();
    await seedVideo(h.db.setup, { title: 'List old', publishedAt: new Date('2026-01-01') });
    await seedVideo(h.db.setup, { title: 'List fresh', publishedAt: new Date('2026-05-01') });
    const fresh = await browseList(h.ctx, user.actor, { profileId: user.profileId, list: 'new' });
    expect(fresh?.title).toBe('New this week');
    expect(fresh?.items.map((i) => i.title).slice(0, 2)).toEqual(['List fresh', 'List old']);
    const trending = await browseList(h.ctx, user.actor, { profileId: user.profileId, list: 'trending' });
    expect(trending?.title).toBe('Trending');
    expect(trending?.nextCursor).toBeNull();
  });

  it('is null for an unknown curated slug, for a guest too', async () => {
    const user = await h.makeUser();
    expect(
      await browseList(h.ctx, user.actor, { profileId: user.profileId, list: 'row', slug: 'nope' }),
    ).toBeNull();
    expect(
      await guestBrowseList(h.ctx, { kids: false, maxRank: 99 } as never, { list: 'row', slug: 'nope' }),
    ).toBeNull();
  });
});
