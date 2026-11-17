import { sql, type SQL } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { rowsOf } from './sql';
import {
  createViewerTestDb,
  FUTURE,
  integrationEnabled,
  NOW,
  PAST,
  seedSeries,
  seedVideo,
  type ViewerTestDb,
} from './testing';
import { liveSeriesSql, liveVideoSql, playableVideoSql } from './visibility';

describe.skipIf(!integrationEnabled())('visibility predicates', () => {
  let t: ViewerTestDb;

  beforeAll(async () => {
    t = await createViewerTestDb();
  });
  afterAll(async () => {
    await t?.drop();
  });

  async function idsWhere(table: 'videos' | 'series', predicate: SQL): Promise<Set<string>> {
    const result = await t.app.execute(
      sql`SELECT x.id FROM ${sql.raw(table)} x WHERE ${predicate}`,
    );
    return new Set(rowsOf<{ id: string }>(result).map((row) => row.id));
  }

  describe('videos', () => {
    it('shows only ready, published, undeleted videos', async () => {
      const published = await seedVideo(t.setup);
      const draft = await seedVideo(t.setup, { publishState: 'draft' });
      const unpublished = await seedVideo(t.setup, { publishState: 'unpublished' });
      const processing = await seedVideo(t.setup, {
        status: 'encoding',
        publishState: 'draft',
        durationMs: null,
      });
      const deleted = await seedVideo(t.setup, { deletedAt: PAST });

      const visible = await idsWhere('videos', liveVideoSql('x', { kids: false }, NOW));

      expect(visible.has(published.id)).toBe(true);
      for (const hidden of [draft, unpublished, processing, deleted]) {
        expect(visible.has(hidden.id)).toBe(false);
      }
    });

    it('hides a scheduled video until its time and shows it afterwards', async () => {
      const dueLater = await seedVideo(t.setup, { publishState: 'scheduled', publishAt: FUTURE });
      const due = await seedVideo(t.setup, { publishState: 'scheduled', publishAt: PAST });

      const visible = await idsWhere('videos', liveVideoSql('x', { kids: false }, NOW));
      const afterFuture = await idsWhere(
        'videos',
        liveVideoSql('x', { kids: false }, new Date(FUTURE.getTime() + 1000)),
      );

      expect(visible.has(dueLater.id)).toBe(false);
      expect(visible.has(due.id)).toBe(true);
      expect(afterFuture.has(dueLater.id)).toBe(true);
    });

    it('limits a kids audience to kids safe videos', async () => {
      const general = await seedVideo(t.setup, { kidsSafe: false });
      const kidsSafe = await seedVideo(t.setup, { kidsSafe: true });

      const kidsView = await idsWhere('videos', liveVideoSql('x', { kids: true }, NOW));

      expect(kidsView.has(kidsSafe.id)).toBe(true);
      expect(kidsView.has(general.id)).toBe(false);
    });
  });

  describe('series', () => {
    it('hides a series with no live episode', async () => {
      const withLive = await seedSeries(t.setup);
      const allDraft = await seedSeries(t.setup, { episode: { publishState: 'draft' } });

      const visible = await idsWhere('series', liveSeriesSql('x', { kids: false }, NOW));

      expect(visible.has(withLive.id)).toBe(true);
      expect(visible.has(allDraft.id)).toBe(false);
    });

    it('shows a series to kids only when the series is kids safe and an episode is too', async () => {
      const kidsSeries = await seedSeries(t.setup, {
        series: { kidsSafe: true },
        episode: { kidsSafe: true },
      });
      const kidsSeriesGeneralEpisodes = await seedSeries(t.setup, {
        series: { kidsSafe: true },
        episode: { kidsSafe: false },
      });
      const generalSeries = await seedSeries(t.setup, { episode: { kidsSafe: true } });

      const visible = await idsWhere('series', liveSeriesSql('x', { kids: true }, NOW));

      expect(visible.has(kidsSeries.id)).toBe(true);
      expect(visible.has(kidsSeriesGeneralEpisodes.id)).toBe(false);
      expect(visible.has(generalSeries.id)).toBe(false);
    });
  });

  describe('playable videos', () => {
    it('hides an episode whose series is unpublished even though the episode is live', async () => {
      const hiddenSeries = await seedSeries(t.setup, { series: { publishState: 'unpublished' } });
      const shownSeries = await seedSeries(t.setup);

      const playable = await idsWhere('videos', playableVideoSql('x', { kids: false }, NOW));

      expect(playable.has(hiddenSeries.episodes[0]!.id)).toBe(false);
      expect(playable.has(shownSeries.episodes[0]!.id)).toBe(true);
    });
  });
});
