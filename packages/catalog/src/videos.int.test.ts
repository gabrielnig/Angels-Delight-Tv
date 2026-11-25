import { eq } from 'drizzle-orm';
import { series as seriesTable, settings, videos } from '@ad/db';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  createViewerTestDb,
  integrationEnabled,
  NOW,
  runAs,
  seedAccount,
  seedAsset,
  seedSeries,
  seedVideo,
  type ViewerTestDb,
} from './testing';
import type { CatalogContext } from './types';
import { fetchVideoCards, listEpisodes } from './videos';

const ctx: CatalogContext = { mediaOrigin: 'https://media.test', now: () => NOW };

describe.skipIf(!integrationEnabled())('video cards and episodes', () => {
  let t: ViewerTestDb;
  let run: ReturnType<typeof runAs>;

  beforeAll(async () => {
    t = await createViewerTestDb();
    const account = await seedAccount(t.setup);
    run = runAs(t.app, { accountId: account.id, role: 'viewer' });
  });
  afterAll(async () => {
    await t?.drop();
  });

  it('returns playable videos and leaves out drafts', async () => {
    const live = await seedVideo(t.setup, { title: 'Playable' });
    const draft = await seedVideo(t.setup, { publishState: 'draft' });

    const cards = await run((tx) => fetchVideoCards(tx, ctx, { kids: false }, [live.id, draft.id]));

    expect([...cards.keys()]).toEqual([live.id]);
    expect(cards.get(live.id)).toMatchObject({ title: 'Playable', episode: null });
  });

  it('describes an episode by its place in the series and falls back to the series poster', async () => {
    const poster = await seedAsset(t.setup);
    const series = await seedSeries(t.setup, {
      series: { title: 'Course', posterAssetId: poster },
      seasonSizes: [2],
    });

    const cards = await run((tx) =>
      fetchVideoCards(tx, ctx, { kids: false }, [series.episodes[1]!.id]),
    );

    const card = cards.get(series.episodes[1]!.id)!;
    expect(card.episode).toMatchObject({ seriesTitle: 'Course', seasonNumber: 1, number: 2 });
    expect(card.poster?.id).toBe(poster);
  });

  it('carries the effective series labels: default, site setting, then the series override (M50)', async () => {
    const plain = await seedSeries(t.setup, { seasonSizes: [1] });
    const own = await seedSeries(t.setup, { seasonSizes: [1] });
    const load = async (id: string) =>
      (await run((tx) => fetchVideoCards(tx, ctx, { kids: false }, [id]))).get(id)!.episode!.labels;

    expect(await load(plain.episodes[0]!.id)).toEqual({ preset: 'season_episode' });

    await t.setup.insert(settings).values({ key: 'content.series_labels', value: { preset: 'book_chapter' } });
    expect(await load(plain.episodes[0]!.id)).toEqual({ preset: 'book_chapter' });

    await t.setup
      .update(seriesTable)
      .set({ labelOverrides: { preset: 'part_lesson', code: 'L' } })
      .where(eq(seriesTable.id, own.id));
    expect(await load(own.episodes[0]!.id)).toEqual({ preset: 'part_lesson', code: 'L' });
    expect(await load(plain.episodes[0]!.id)).toEqual({ preset: 'book_chapter' });

    await t.setup.delete(settings).where(eq(settings.key, 'content.series_labels'));
  });

  it('refuses a label override that is not an object', async () => {
    const s = await seedSeries(t.setup, { seasonSizes: [1] });
    await expect(
      t.setup.update(seriesTable).set({ labelOverrides: [1] }).where(eq(seriesTable.id, s.id)),
    ).rejects.toThrow();
  });

  it('hides an episode while its series is unpublished', async () => {
    const series = await seedSeries(t.setup, { series: { publishState: 'unpublished' } });

    const cards = await run((tx) =>
      fetchVideoCards(tx, ctx, { kids: false }, [series.episodes[0]!.id]),
    );

    expect(cards.size).toBe(0);
  });

  it('lists episodes by season then number and skips an unpublished one', async () => {
    const series = await seedSeries(t.setup, { seasonSizes: [2, 2] });
    await t.setup
      .update(videos)
      .set({ publishState: 'unpublished' })
      .where(eq(videos.id, series.episodes[1]!.id));

    const map = await run((tx) => listEpisodes(tx, ctx, { kids: false }, [series.id]));

    expect(
      map.get(series.id)?.map((e) => `${e.episode!.seasonNumber}.${e.episode!.number}`),
    ).toEqual(['1.1', '2.1', '2.2']);
  });
});
