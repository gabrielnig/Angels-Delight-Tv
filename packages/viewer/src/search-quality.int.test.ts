import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { listMisses, refreshSearchTerms } from '@ad/catalog';
import { search, searchFor } from './search';
import {
  categorize,
  createHarness,
  NOW,
  seedCategory,
  seedVideo,
  type ViewerHarness,
} from './testing';

describe.skipIf(!process.env.TEST_DATABASE_ADMIN_URL)('search quality service (M45)', () => {
  let h: ViewerHarness;
  beforeAll(async () => {
    h = await createHarness();
    h.setNow(NOW);
    await seedVideo(h.db.setup, { title: 'Budgeting for families' });
    await seedVideo(h.db.setup, { title: 'Budgeting at school', suitability: 'kids', kidsSafe: true });
    const shelf = await seedCategory(h.db.setup, 'Farming skills');
    const v = await seedVideo(h.db.setup, { title: 'Soil basics' });
    await categorize(h.db.setup, { videoId: v.id }, shelf.id);
    await refreshSearchTerms(h.db.setup);
  });
  afterAll(async () => {
    await h?.drop();
  });
  const general = { kids: false, maxRank: 4 };

  it('returns showingFor for a corrected query, for an account', async () => {
    const user = await h.makeUser();
    const r = await search(h.ctx, user.actor, { profileId: user.profileId, query: 'budgetng' });
    expect(r.showingFor).toBe('budgeting');
    expect(r.items.length).toBeGreaterThan(0);
    expect(r.didYouMean).toBeNull();
  });

  it('works the same for a guest, without any sign in', async () => {
    const r = await searchFor(h.ctx, general, { query: 'budgetng' });
    expect(r.showingFor).toBe('budgeting');
  });

  it('keeps a kids profile to kids safe titles in the corrected results', async () => {
    const user = await h.makeUser();
    const r = await search(h.ctx, user.actor, { profileId: user.kidsProfileId, query: 'budgetng' });
    expect(r.items.map((i) => i.title)).toEqual(['Budgeting at school']);
  });

  it('returns subjects for a category word', async () => {
    const r = await searchFor(h.ctx, general, { query: 'farming' });
    expect(r.subjects).toEqual([{ slug: 'farming-skills', name: 'Farming skills' }]);
  });

  it('records a miss without any identifier when nothing matches and the search was submitted', async () => {
    await searchFor(h.ctx, general, { query: 'Qwxzv Unmatched', record: true });
    const misses = await listMisses(h.db.setup, 20);
    expect(misses.map((m) => m.query)).toContain('qwxzv unmatched');
  });

  it('does not record a miss for a kids profile or when the search was not submitted', async () => {
    const user = await h.makeUser();
    await search(h.ctx, user.actor, { profileId: user.kidsProfileId, query: 'kidsonlymiss', record: true });
    await searchFor(h.ctx, general, { query: 'typingonlymiss' });
    const queries = (await listMisses(h.db.setup, 50)).map((m) => m.query);
    expect(queries).not.toContain('kidsonlymiss');
    expect(queries).not.toContain('typingonlymiss');
  });

  it('never fails the search when miss logging breaks', async () => {
    await h.db.setup.execute(sql`ALTER TABLE search_misses RENAME TO search_misses_x`);
    try {
      const r = await searchFor(h.ctx, general, { query: 'nothingfoundhere', record: true });
      expect(r.total).toBe(0);
    } finally {
      await h.db.setup.execute(sql`ALTER TABLE search_misses_x RENAME TO search_misses`);
    }
  });
});
