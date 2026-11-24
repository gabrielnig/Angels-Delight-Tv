import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  listMisses,
  pruneMisses,
  recordMiss,
  refreshSearchTerms,
  replaceSynonymGroups,
  searchSubjects,
  searchWithCorrection,
} from './search-quality';
import {
  categorize,
  createViewerTestDb,
  integrationEnabled,
  NOW,
  runAs,
  seedAccount,
  seedCategory,
  seedVideo,
  type ViewerTestDb,
} from './testing';
import { rowsOf } from './sql';
import type { CatalogContext } from './types';

const ctx: CatalogContext = { mediaOrigin: 'https://media.test', now: () => NOW };
const general = { kids: false };
const kids = { kids: true };

describe.skipIf(!integrationEnabled())('search quality (M45-S07 to S09)', () => {
  let t: ViewerTestDb;
  let run: ReturnType<typeof runAs>;

  beforeAll(async () => {
    t = await createViewerTestDb();
    const account = await seedAccount(t.setup);
    run = runAs(t.app, { accountId: account.id, role: 'viewer' });
    await seedVideo(t.setup, {
      title: 'Budgeting for beginners',
      description: 'Plan your income.',
    });
    await seedVideo(t.setup, { title: 'Understanding finance', description: 'How banks work.' });
    await seedVideo(t.setup, { title: 'Wetin dey happen for market', description: 'Pidgin talk.' });
    await seedVideo(t.setup, { title: 'Cast iron cooking', description: 'Kitchen.' });
    await seedVideo(t.setup, {
      title: 'Budgeting for kids',
      description: 'Pocket money games.',
      suitability: 'kids',
      kidsSafe: true,
    });
    const money = await seedCategory(t.setup, 'Money skills');
    const v = await seedVideo(t.setup, { title: 'Saving habits', description: 'Small steps.' });
    await categorize(t.setup, { videoId: v.id }, money.id);
    await refreshSearchTerms(t.setup);
  });
  afterAll(async () => {
    await t?.drop();
  });
  beforeEach(async () => {
    await t.setup.execute(sql`DELETE FROM search_synonyms`);
  });

  const search = (query: string, audience = general) =>
    run((tx) => searchWithCorrection(tx, ctx, audience, { query }));
  const titles = (r: Awaited<ReturnType<typeof search>>) => r.page.items.map((i) => i.title);

  it('corrects budgetng to budgeting and says what it shows', async () => {
    const r = await search('budgetng');
    expect(r.showingFor).toBe('budgeting');
    expect(titles(r)).toContain('Budgeting for beginners');
  });

  it('does not fuzzy match words under 5 characters', async () => {
    const r = await search('cash');
    expect(r.showingFor).toBeNull();
    expect(r.page.total).toBe(0);
    const r2 = await search('cast');
    expect(titles(r2)).toEqual(['Cast iron cooking']);
  });

  it('leaves a word that already exists alone, so pidgin words are matched without stemming', async () => {
    const r = await search('wetin');
    expect(r.showingFor).toBeNull();
    expect(titles(r)).toEqual(['Wetin dey happen for market']);
    const typo = await search('markit');
    expect(typo.showingFor === null || typo.showingFor === 'market').toBe(true);
  });

  it('expands money to finance titles through synonyms, below exact matches', async () => {
    await replaceSynonymGroups(t.app, [['money', 'finance', 'cash']]);
    const r = await search('money');
    expect(titles(r)).toContain('Understanding finance');
    const exact = titles(r).indexOf('Saving habits');
    expect(exact).toBeGreaterThanOrEqual(0);
    expect(exact).toBeLessThan(titles(r).indexOf('Understanding finance'));
  });

  it('caps synonym expansion at 8', async () => {
    for (let i = 0; i < 12; i++)
      await seedVideo(t.setup, { title: `Lesson zeta${i}`, description: 'x' });
    await replaceSynonymGroups(t.app, [
      ['alpha', ...Array.from({ length: 12 }, (_, i) => `zeta${i}`)],
    ]);
    const r = await search('alpha');
    expect(r.page.total).toBe(8);
  });

  it('a category name returns that category as a subject', async () => {
    const subjects = await run((tx) => searchSubjects(tx, ctx, general, 'money'));
    expect(subjects.map((s) => s.name)).toEqual(['Money skills']);
    expect(subjects[0]?.slug).toBe('money-skills');
  });

  it('kids audience never returns non kids titles for a corrected query', async () => {
    const r = await search('budgetng', kids);
    expect(titles(r)).toEqual(['Budgeting for kids']);
  });

  it('suggests a correction as a link when a few results exist', async () => {
    const r = await search('financ');
    expect(r.page.total).toBeGreaterThan(0);
  });

  describe('misses', () => {
    it('records a miss without any identifier and counts repeats', async () => {
      await recordMiss(t.app, '  Zzyzx  Quantum ', NOW);
      await recordMiss(t.app, 'zzyzx quantum', NOW);
      const rows = await listMisses(t.app, 10);
      expect(rows).toEqual([{ query: 'zzyzx quantum', hits: 2, lastSeen: NOW }]);
      const cols = rowsOf<{ column_name: string }>(
        await t.setup.execute(
          sql`SELECT column_name FROM information_schema.columns WHERE table_name = 'search_misses'`,
        ),
      ).map((c) => c.column_name);
      expect(cols.sort()).toEqual(['hits', 'last_seen', 'query_norm']);
    });

    it('caps the stored query at 80 characters', async () => {
      await recordMiss(t.app, 'x'.repeat(200), NOW);
      const rows = await listMisses(t.app, 50);
      expect(rows.every((r) => r.query.length <= 80)).toBe(true);
    });

    it('prunes misses older than 90 days', async () => {
      await recordMiss(t.app, 'old miss', new Date(NOW.getTime() - 91 * 86_400_000));
      await recordMiss(t.app, 'new miss', NOW);
      await pruneMisses(t.app, NOW);
      const found = (await listMisses(t.app, 50)).map((r) => r.query);
      expect(found).toContain('new miss');
      expect(found).not.toContain('old miss');
    });

    it('never throws when logging fails', async () => {
      await expect(recordMiss(t.app, '', NOW)).resolves.toBeUndefined();
    });
  });
});
