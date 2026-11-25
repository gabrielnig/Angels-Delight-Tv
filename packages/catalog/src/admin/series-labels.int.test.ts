import { eq } from 'drizzle-orm';
import { auditLog, series, settings } from '@ad/db';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { getAdminSeriesDetail, listAdminSeries, setAdminEpisode, updateAdminSeries } from './series';
import {
  createViewerTestDb,
  integrationEnabled,
  seedAccount,
  seedSeries,
  type ViewerTestDb,
} from '../testing';

describe.skipIf(!integrationEnabled())('series label override and worded admin messages (M50)', () => {
  let t: ViewerTestDb;
  let editor: { accountId: string; role: 'editor' };
  beforeAll(async () => {
    t = await createViewerTestDb();
    editor = { accountId: (await seedAccount(t.setup, 'editor')).id, role: 'editor' };
  });
  afterAll(async () => {
    await t?.drop();
  });

  it('saves an override, reports it and the effective words, and clears it with null', async () => {
    const s = await seedSeries(t.setup, { seasonSizes: [2] });
    const done = await updateAdminSeries({ db: t.app }, editor, s.id, {
      labels: { preset: 'custom', custom: { group: { one: 'Volume', other: 'Volumes' }, item: { one: 'Study', other: 'Studies' } }, code: ' St ' },
    });
    expect(done.ok).toBe(true);
    const detail = await getAdminSeriesDetail({ db: t.app }, editor, s.id);
    expect(detail.series.labelOverride).toMatchObject({ preset: 'custom', code: 'St' });
    expect(detail.series.labels).toMatchObject({ preset: 'custom' });
    const [log] = await t.setup.select().from(auditLog).where(eq(auditLog.action, 'series.labels'));
    expect(log?.targetId).toBe(s.id);

    expect((await updateAdminSeries({ db: t.app }, editor, s.id, { labels: null })).ok).toBe(true);
    const cleared = await getAdminSeriesDetail({ db: t.app }, editor, s.id);
    expect(cleared.series.labelOverride).toBeNull();
    expect(cleared.series.labels).toEqual({ preset: 'season_episode' });
  });

  it('refuses invalid words and changes nothing', async () => {
    const s = await seedSeries(t.setup, { seasonSizes: [1] });
    const bad = await updateAdminSeries({ db: t.app }, editor, s.id, {
      labels: { preset: 'custom', custom: { group: { one: '<b>', other: 'x' }, item: { one: 'y', other: 'z' } } },
    });
    expect(bad.ok).toBe(false);
    const [row] = await t.setup.select().from(series).where(eq(series.id, s.id));
    expect(row?.labelOverrides).toBeNull();
  });

  it('uses the owner words in the clash message and the publish refusal', async () => {
    await t.setup.insert(settings).values({ key: 'content.series_labels', value: { preset: 'book_chapter' } });
    const s = await seedSeries(t.setup, { seasonSizes: [2], series: { publishState: 'draft' } });
    const other = await seedSeries(t.setup, { seasonSizes: [1] });
    const clash = await setAdminEpisode({ db: t.app }, editor, other.episodes[0]!.id, s.id, 1, 2);
    expect(clash).toEqual({ ok: false, error: 'Book 1 already has Chapter 2.' });

    const empty = await seedSeries(t.setup, { seasonSizes: [], series: { publishState: 'draft' } });
    const refused = await updateAdminSeries({ db: t.app }, editor, empty.id, { published: true });
    expect(refused).toEqual({ ok: false, error: 'Publish at least one chapter before publishing the series.' });
    await t.setup.delete(settings).where(eq(settings.key, 'content.series_labels'));
  });

  it('lists the effective labels on the series list', async () => {
    const rows = await listAdminSeries({ db: t.app }, editor);
    expect(rows.every((r) => r.labels.preset.length > 0)).toBe(true);
  });
});
