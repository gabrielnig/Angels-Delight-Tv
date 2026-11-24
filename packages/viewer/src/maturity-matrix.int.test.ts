import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { browse } from './browse';
import { getHome } from './home';
import { addToMyList } from './my-list';
import { saveProgress } from './progress';
import { updateProfile } from './profiles';
import { search, suggest } from './search';
import { getTitleDetail } from './title-detail';
import { createHarness, NOW, seedVideo, seedSeries, type ViewerHarness } from './testing';

describe.skipIf(!process.env.TEST_DATABASE_ADMIN_URL)('maturity limit on every viewer surface', () => {
  let h: ViewerHarness;
  let limited: { actor: import('@ad/shared').Actor; profileId: string };
  let fine: { id: string };
  let high: { id: string };
  let unrated: { id: string };
  let highSeries: { id: string };

  beforeAll(async () => {
    h = await createHarness();
    h.setNow(NOW);
    fine = await seedVideo(h.db.setup, { title: 'Matrix fine', maturityRank: 2 });
    high = await seedVideo(h.db.setup, { title: 'Matrix fifteen', maturityRank: 3 });
    unrated = await seedVideo(h.db.setup, { title: 'Matrix unrated' });
    highSeries = await seedSeries(h.db.setup, {
      series: { title: 'Matrix fifteen series', maturityRank: 3 },
      episode: { maturityRank: 3 },
    });
    const user = await h.makeUser();
    await updateProfile(h.ctx, user.actor, user.profileId, { maxMaturityRank: 2 });
    limited = user;
  });
  afterAll(async () => {
    await h?.drop();
  });

  const ids = (items: { id: string }[]) => items.map((i) => i.id);

  it('browse, search and suggest hide titles above the limit and unrated ones', async () => {
    const page = await browse(h.ctx, limited.actor, { profileId: limited.profileId, sort: 'newest' });
    expect(ids(page.items)).toContain(fine.id);
    for (const hidden of [high.id, unrated.id, highSeries.id])
      expect(ids(page.items)).not.toContain(hidden);
    const found = await search(h.ctx, limited.actor, { profileId: limited.profileId, query: 'matrix' });
    expect(ids(found.items)).toEqual([fine.id]);
    const hints = await suggest(h.ctx, limited.actor, { profileId: limited.profileId, query: 'matrix' });
    expect(JSON.stringify(hints)).not.toContain('fifteen');
  });

  it('a direct link, a My List add and a progress save answer not found', async () => {
    await expect(
      getTitleDetail(h.ctx, limited.actor, { profileId: limited.profileId, id: high.id }),
    ).rejects.toMatchObject({ status: 404 });
    await expect(
      getTitleDetail(h.ctx, limited.actor, { profileId: limited.profileId, id: unrated.id }),
    ).rejects.toMatchObject({ status: 404 });
    await expect(
      addToMyList(h.ctx, limited.actor, {
        profileId: limited.profileId,
        target: { kind: 'series', id: highSeries.id },
      }),
    ).rejects.toMatchObject({ status: 404 });
    await expect(
      saveProgress(h.ctx, limited.actor, { profileId: limited.profileId, videoId: high.id, positionMs: 30_000 }),
    ).rejects.toMatchObject({ status: 404 });
    await expect(
      getTitleDetail(h.ctx, limited.actor, { profileId: limited.profileId, id: fine.id }),
    ).resolves.toBeTruthy();
  });

  it('home rows do not leak a title above the limit', async () => {
    const home = await getHome(h.ctx, limited.actor, { profileId: limited.profileId });
    const text = JSON.stringify(home);
    expect(text).not.toContain(high.id);
    expect(text).not.toContain(unrated.id);
  });
});
