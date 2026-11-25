import { eq } from 'drizzle-orm';
import { auditLog, seasons } from '@ad/db';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { getAdminSeriesDetail, moveAdminEpisode, renameAdminGroup } from './series';
import { createViewerTestDb, integrationEnabled, seedAccount, seedSeries, type ViewerTestDb } from '../testing';

describe.skipIf(!integrationEnabled())('group titles (M51-S05)', () => {
  let t: ViewerTestDb;
  let editor: { accountId: string; role: 'editor' };
  beforeAll(async () => {
    t = await createViewerTestDb();
    editor = { accountId: (await seedAccount(t.setup, 'editor')).id, role: 'editor' };
  });
  afterAll(async () => {
    await t?.drop();
  });

  it('names a group, lists it in the detail and writes an audit entry', async () => {
    const s = await seedSeries(t.setup, { seasonSizes: [2, 1] });
    expect(await renameAdminGroup({ db: t.app }, editor, s.id, 2, '  Exodus  ')).toEqual({ ok: true });
    const [row] = await t.setup.select().from(seasons).where(eq(seasons.seriesId, s.id));
    expect(row?.title ?? null).toBeNull();
    const detail = await getAdminSeriesDetail({ db: t.app }, editor, s.id);
    expect(detail.groups).toEqual([
      { number: 1, title: null },
      { number: 2, title: 'Exodus' },
    ]);
    const log = await t.setup.select().from(auditLog).where(eq(auditLog.action, 'series.group_rename'));
    expect(log.some((l) => l.targetId === s.id)).toBe(true);
  });

  it('a blank title goes back to the numbered name', async () => {
    const s = await seedSeries(t.setup, { seasonSizes: [1] });
    await renameAdminGroup({ db: t.app }, editor, s.id, 1, 'Genesis');
    await renameAdminGroup({ db: t.app }, editor, s.id, 1, '   ');
    expect((await getAdminSeriesDetail({ db: t.app }, editor, s.id)).groups[0]?.title).toBeNull();
  });

  it('refuses a long title and an unknown group and changes nothing', async () => {
    const s = await seedSeries(t.setup, { seasonSizes: [1] });
    expect(await renameAdminGroup({ db: t.app }, editor, s.id, 1, 'x'.repeat(61))).toEqual({
      ok: false,
      error: 'Use 60 characters or fewer.',
    });
    expect((await renameAdminGroup({ db: t.app }, editor, s.id, 9, 'Nope')).ok).toBe(false);
  });
});

describe.skipIf(!integrationEnabled())('moving an item up or down (M51-S05)', () => {
  let t: ViewerTestDb;
  let editor: { accountId: string; role: 'editor' };
  beforeAll(async () => {
    t = await createViewerTestDb();
    editor = { accountId: (await seedAccount(t.setup, 'editor')).id, role: 'editor' };
  });
  afterAll(async () => {
    await t?.drop();
  });

  const order = async (id: string) =>
    (await getAdminSeriesDetail({ db: t.app }, editor, id)).episodes.map((e) => e.id);

  it('swaps numbers with the neighbour in the same group and audits it', async () => {
    const s = await seedSeries(t.setup, { seasonSizes: [3] });
    const [a, b, c] = s.episodes.map((e) => e.id) as [string, string, string];
    expect(await moveAdminEpisode({ db: t.app }, editor, s.id, c, 'up')).toEqual({ ok: true });
    expect(await order(s.id)).toEqual([a, c, b]);
    expect(await moveAdminEpisode({ db: t.app }, editor, s.id, a, 'down')).toEqual({ ok: true });
    expect(await order(s.id)).toEqual([c, a, b]);
    const log = await t.setup.select().from(auditLog).where(eq(auditLog.action, 'series.episode_move'));
    expect(log.length).toBe(2);
  });

  it('says so at the ends and keeps the order', async () => {
    const s = await seedSeries(t.setup, { seasonSizes: [2] });
    const [a, b] = s.episodes.map((e) => e.id) as [string, string];
    expect((await moveAdminEpisode({ db: t.app }, editor, s.id, a, 'up')).ok).toBe(false);
    expect((await moveAdminEpisode({ db: t.app }, editor, s.id, b, 'down')).ok).toBe(false);
    expect(await order(s.id)).toEqual([a, b]);
  });

  it('does not cross into another group', async () => {
    const s = await seedSeries(t.setup, { seasonSizes: [1, 1] });
    const second = s.episodes[1]!.id;
    expect((await moveAdminEpisode({ db: t.app }, editor, s.id, second, 'up')).ok).toBe(false);
  });
});
