import { sql } from 'drizzle-orm';
import type { Database } from '@ad/db';
import { lagosDay } from './day';

export interface TrendingConfig {
  windowDays: number;
  /** Weight of a day is decay to the power of its age in days, today is age 0. */
  decay: number;
  /** One viewer counts at most this many plays of a title per day. */
  perViewerDailyCap: number;
  /** A title needs at least this many capped plays in the window to qualify. */
  minPlays: number;
  popularWindowDays: number;
  /** Rows kept per kind. */
  keep: number;
}

export const DEFAULT_TRENDING_CONFIG: TrendingConfig = {
  windowDays: 7,
  decay: 0.8,
  perViewerDailyCap: 3,
  minPlays: 10,
  popularWindowDays: 30,
  keep: 60,
};

type Kind = 'trending' | 'popular';

/** The plays of one title per Lagos day: capped per viewer for trending, plain counts for popular. */
function scoreQuery(kind: Kind, today: string, config: TrendingConfig) {
  const days = kind === 'trending' ? config.windowDays : config.popularWindowDays;
  const cap = kind === 'trending' ? config.perViewerDailyCap : 1_000_000;
  const extraForCompletion = kind === 'trending' ? sql`done` : sql`0`;
  const weight = kind === 'trending' ? sql`power(${config.decay}::float8, age)` : sql`1.0`;
  const minPlays = kind === 'trending' ? config.minPlays : 1;
  return sql`
    WITH ev AS (
      SELECT e.video_id,
        (e.started_at AT TIME ZONE 'Africa/Lagos')::date AS day,
        coalesce(e.viewer_hash, e.play_id::text) AS who,
        count(*) AS n, count(*) FILTER (WHERE e.completed) AS done
      FROM view_events e
      WHERE (e.started_at AT TIME ZONE 'Africa/Lagos')::date > ${today}::date - ${days}::int
        AND (e.started_at AT TIME ZONE 'Africa/Lagos')::date <= ${today}::date
      GROUP BY 1, 2, 3
    ), per_video AS (
      SELECT video_id, (${today}::date - day) AS age,
        LEAST(n, ${cap}::int) AS raw, LEAST(n, ${cap}::int) + ${extraForCompletion} AS weighted
      FROM ev
    ), per_title AS (
      SELECT coalesce(s.id::text, 'v:' || p.video_id::text) AS unit,
        s.id AS series_id,
        CASE WHEN s.id IS NULL THEN p.video_id END AS video_id,
        sum(${weight} * p.weighted)::float8 AS score, sum(p.raw)::int AS plays
      FROM per_video p
      LEFT JOIN episodes ep ON ep.video_id = p.video_id
      LEFT JOIN seasons sn ON sn.id = ep.season_id
      LEFT JOIN series s ON s.id = sn.series_id
      GROUP BY 1, 2, 3
    )
    SELECT series_id, video_id, score, plays,
      (row_number() OVER (ORDER BY score DESC, plays DESC, unit))::int AS rank
    FROM per_title WHERE plays >= ${minPlays}::int
    ORDER BY rank LIMIT ${config.keep}::int`;
}

/**
 * Rebuilds the trending and popular snapshot (`title_scores`) from raw view events (M44-S07, S08). Each kind is
 * replaced in its own transaction, so a crash leaves the old snapshot and a rerun gives the same rows.
 */
export async function refreshTrending(
  db: Database,
  now: Date,
  config: TrendingConfig = DEFAULT_TRENDING_CONFIG,
): Promise<{ trending: number; popular: number }> {
  const today = lagosDay(now);
  const counts = { trending: 0, popular: 0 };
  for (const kind of ['trending', 'popular'] as const) {
    counts[kind] = await db.transaction(async (tx) => {
      const rows = (await tx.execute(scoreQuery(kind, today, config))).rows as unknown as Array<{
        series_id: string | null;
        video_id: string | null;
        score: number;
        plays: number;
        rank: number;
      }>;
      await tx.execute(sql`DELETE FROM title_scores WHERE kind = ${kind}`);
      for (const row of rows) {
        await tx.execute(sql`
          INSERT INTO title_scores (kind, video_id, series_id, score, plays, rank, computed_at)
          VALUES (${kind}, ${row.video_id}::uuid, ${row.series_id}::uuid, ${row.score}, ${row.plays}, ${row.rank}, ${now}::timestamptz)`);
      }
      return rows.length;
    });
  }
  return counts;
}
