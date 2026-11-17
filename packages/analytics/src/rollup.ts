import { sql } from 'drizzle-orm';
import { addDays, dayBounds, lagosDay } from './day';
import type { SqlExecutor } from './sql';

/** Nightly at 02:00 Africa/Lagos (M19-S06). The worker lane registers it with the queue. */
export const ROLLUP_SCHEDULE = { cron: '0 2 * * *', timeZone: 'Africa/Lagos' } as const;
/** Monthly retention work, first day of the month at 03:00 Africa/Lagos. */
export const RETENTION_SCHEDULE = { cron: '0 3 1 * *', timeZone: 'Africa/Lagos' } as const;
export const DEFAULT_RAW_RETENTION_DAYS = 730;

/**
 * Recomputes one Lagos day into `video_daily_stats` and `site_daily_stats`. Rerunning a day replaces its rows,
 * stale per-video rows are removed, and each table is written by one atomic statement.
 */
export async function rollupDay(db: SqlExecutor, day: string): Promise<void> {
  const { start, end } = dayBounds(day);
  const from = start.toISOString();
  const to = end.toISOString();

  await db.execute(sql`
    WITH agg AS (
      SELECT video_id, count(*)::int AS views, COALESCE(sum(watched_ms), 0)::bigint AS watch_ms,
             (count(*) FILTER (WHERE completed))::int AS completions
      FROM view_events
      WHERE started_at >= ${from}::timestamptz AND started_at < ${to}::timestamptz
      GROUP BY video_id
    ), removed AS (
      DELETE FROM video_daily_stats
      WHERE day = ${day}::date AND video_id NOT IN (SELECT video_id FROM agg)
    )
    INSERT INTO video_daily_stats AS s (video_id, day, views, watch_ms, completions)
    SELECT video_id, ${day}::date, views, watch_ms, completions FROM agg
    ON CONFLICT (video_id, day) DO UPDATE SET
      views = EXCLUDED.views, watch_ms = EXCLUDED.watch_ms, completions = EXCLUDED.completions`);

  await db.execute(sql`
    INSERT INTO site_daily_stats AS s (day, views, uniques, watch_ms, completions)
    SELECT ${day}::date, count(*)::int, count(DISTINCT viewer_hash)::int,
           COALESCE(sum(watched_ms), 0)::bigint, (count(*) FILTER (WHERE completed))::int
    FROM view_events
    WHERE started_at >= ${from}::timestamptz AND started_at < ${to}::timestamptz
    ON CONFLICT (day) DO UPDATE SET
      views = EXCLUDED.views, uniques = EXCLUDED.uniques,
      watch_ms = EXCLUDED.watch_ms, completions = EXCLUDED.completions`);
}

/** The nightly job body: yesterday plus the day before, to pick up plays that finished after a midnight cut. */
export async function runNightlyRollup(db: SqlExecutor, now: Date = new Date()): Promise<string[]> {
  const yesterday = addDays(lagosDay(now), -1);
  const days = [addDays(yesterday, -1), yesterday];
  for (const day of days) await rollupDay(db, day);
  return days;
}

/** Rebuilds an inclusive range, for example after a bug fix. */
export async function backfillRollups(db: SqlExecutor, from: string, to: string): Promise<number> {
  let count = 0;
  for (let day = from; day <= to; day = addDays(day, 1)) {
    await rollupDay(db, day);
    count += 1;
  }
  return count;
}

/** Deletes raw rows past the retention window. Run as ad_maintenance. Rollups keep the history. */
export async function pruneViewEvents(
  db: SqlExecutor,
  options: { now?: Date; retentionDays?: number } = {},
): Promise<void> {
  const now = options.now ?? new Date();
  const cutoff = new Date(
    now.getTime() - (options.retentionDays ?? DEFAULT_RAW_RETENTION_DAYS) * 86_400_000,
  );
  await db.execute(
    sql`DELETE FROM view_events WHERE started_at < ${cutoff.toISOString()}::timestamptz`,
  );
}
