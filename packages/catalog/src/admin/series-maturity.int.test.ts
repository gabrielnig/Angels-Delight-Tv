import { eq } from 'drizzle-orm';
import { series, videos } from '@ad/db';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { getAdminSeriesDetail, updateAdminSeries } from './series';
import {
  createViewerTestDb,
  integrationEnabled,
  seedAccount,
  seedSeries,
  type ViewerTestDb,
} from '../testing';

describe.skipIf(!integrationEnabled())('series maturity rating', () => {
  let t: ViewerTestDb;
  let editor: { accountId: string; role: 'editor' };
  beforeAll(async () => {
    t = await createViewerTestDb();
    editor = { accountId: (await seedAccount(t.setup, 'editor')).id, role: 'editor' };
  });
  afterAll(async () => {
    await t?.drop();
  });

  it('sets the series rank and keeps kids_safe in step', async () => {
    const s = await seedSeries(t.setup, { series: { maturityRank: 3 }, episode: { maturityRank: 3 } });
    const done = await updateAdminSeries({ db: t.app }, editor, s.id, { maturityRank: 0 });
    expect(done.ok).toBe(true);
    const [row] = await t.setup.select().from(series).where(eq(series.id, s.id));
    expect(row).toMatchObject({ maturityRank: 0, kidsSafe: true });
    const detail = await getAdminSeriesDetail({ db: t.app }, editor, s.id);
    expect(detail?.series.maturityRank).toBe(0);
    const [ep] = await t.setup.select().from(videos).where(eq(videos.id, s.episodes[0]!.id));
    expect(ep?.maturityRank).toBe(3);
  });

  it('applies the rank to every episode only when asked', async () => {
    const s = await seedSeries(t.setup, { series: { maturityRank: 2 }, episode: { maturityRank: 4 } });
    const done = await updateAdminSeries({ db: t.app }, editor, s.id, {
      maturityRank: 1,
      applyToEpisodes: true,
    });
    expect(done.ok).toBe(true);
    for (const e of s.episodes) {
      const [ep] = await t.setup.select().from(videos).where(eq(videos.id, e.id));
      expect(ep?.maturityRank).toBe(1);
    }
  });

  it('rejects a rank outside the ladder and changes nothing', async () => {
    const s = await seedSeries(t.setup, { series: { maturityRank: 2 } });
    const done = await updateAdminSeries({ db: t.app }, editor, s.id, { maturityRank: 9 });
    expect(done.ok).toBe(false);
    const [row] = await t.setup.select().from(series).where(eq(series.id, s.id));
    expect(row?.maturityRank).toBe(2);
  });
});
