import { sql } from 'drizzle-orm';
import { addDays, dayBounds, lagosDay, previousPeriod, type DayRange } from './day';
import { percentileFromBuckets } from './histogram';
import { SHARE_CHANNELS } from './events';
import { rowsOf, type SqlExecutor } from './sql';

export interface PeriodTotals {
  views: number;
  /** Sum of daily unique viewers. The viewer id rotates daily, so a person on two days counts twice. */
  uniqueViewers: number;
  watchMs: number;
  avgWatchMsPerViewer: number;
  completionRate: number;
}

export interface OverviewResult {
  range: DayRange;
  current: PeriodTotals;
  previous: PeriodTotals;
  daily: Array<{ day: string; views: number; watchMs: number }>;
}

import { positiveShare, type RatingTotals } from './ratings';

export interface TopTitle {
  videoId: string;
  title: string;
  views: number;
  watchMs: number;
  completionRate: number;
  avgPercentWatched: number;
  /** Lifetime rating counts, when the title has any. Added by the caller from ratingTotals. */
  ratings?: RatingTotals;
}

export interface RetentionPoint {
  /** Position in the video as a percent of its duration, 0 to 95. */
  atPercent: number;
  /** Share of plays still watching at that point, 0 to 100. */
  percent: number;
}

export interface SplitRow {
  label: string;
  count: number;
  percent: number;
}

/** One title on one Lagos day, for the CSV export (M19-S05). */
export interface TitleDailyRow {
  day: string;
  videoId: string;
  title: string;
  /** The title was deleted after it was watched. Its numbers still count. */
  archived: boolean;
  views: number;
  watchMs: number;
  completions: number;
  /** Lifetime rating counts, only when the title has a ratings row. */
  likes?: number;
  loves?: number;
  dislikes?: number;
  /** Whole percent, or null under ten ratings. */
  positiveShare?: number | null;
}

export interface QueryOptions {
  now?: () => Date;
  /** Short cache for numbers that include today (M19-S06 edge). 0 disables it. */
  cacheTtlMs?: number;
}

export const MIN_SPLIT_GROUP = 10;
export const RETENTION_POINTS = 20;

const num = (value: unknown): number => Number(value ?? 0);
const ratio = (a: number, b: number): number => (b > 0 ? a / b : 0);

export interface ShareCount {
  channel: string;
  count: number;
}

/** Share counters per channel, biggest first. Unknown channels and zeros are dropped. */
export function shareRows(rows: Array<{ key: string; total: string }>): ShareCount[] {
  const known: readonly string[] = SHARE_CHANNELS;
  return rows
    .filter((row) => known.includes(row.key) && num(row.total) > 0)
    .map((row) => ({ channel: row.key, count: num(row.total) }))
    .sort((a, b) => b.count - a.count || a.channel.localeCompare(b.channel));
}

/** Groups under the privacy threshold are merged into Other (M19-S04 AC2). */
export function buildSplit(counts: Record<string, number>, minGroup = MIN_SPLIT_GROUP): SplitRow[] {
  const total = Object.values(counts).reduce((sum, count) => sum + count, 0);
  if (total === 0) return [];
  let other = 0;
  const rows: SplitRow[] = [];
  for (const [label, count] of Object.entries(counts)) {
    if (count < minGroup) other += count;
    else rows.push({ label, count, percent: (count / total) * 100 });
  }
  rows.sort((a, b) => b.count - a.count);
  if (other > 0) rows.push({ label: 'Other', count: other, percent: (other / total) * 100 });
  return rows;
}

export function createAnalyticsQueries(db: SqlExecutor, options: QueryOptions = {}) {
  const now = options.now ?? (() => new Date());
  const ttl = options.cacheTtlMs ?? 15_000;
  const cache = new Map<string, { at: number; value: unknown }>();

  async function cached<T>(key: string, load: () => Promise<T>): Promise<T> {
    if (ttl <= 0) return load();
    const hit = cache.get(key);
    const t = now().getTime();
    if (hit && t - hit.at < ttl) return hit.value as T;
    const value = await load();
    cache.set(key, { at: t, value });
    return value;
  }

  /** Days before today come from rollups. Today is read live from raw rows. */
  function split(range: DayRange) {
    const today = lagosDay(now());
    const rolledTo = range.to < today ? range.to : addDays(today, -1);
    const liveIncluded = range.from <= today && today <= range.to;
    const bounds = dayBounds(today);
    return {
      rolledFrom: range.from,
      rolledTo,
      liveStart: liveIncluded ? bounds.start.toISOString() : '9999-01-01T00:00:00Z',
      liveEnd: liveIncluded ? bounds.end.toISOString() : '9999-01-02T00:00:00Z',
      today,
      liveIncluded,
    };
  }

  async function siteDaily(range: DayRange) {
    const s = split(range);
    const rows = rowsOf<{
      day: string;
      views: number;
      uniques: number;
      watch_ms: string;
      completions: number;
    }>(
      await db.execute(sql`
        SELECT to_char(day, 'YYYY-MM-DD') AS day, views, uniques, watch_ms, completions
        FROM site_daily_stats WHERE day BETWEEN ${s.rolledFrom}::date AND ${s.rolledTo}::date
        UNION ALL
        SELECT ${s.today}, count(*)::int, count(DISTINCT viewer_hash)::int, COALESCE(sum(watched_ms), 0)::bigint,
               (count(*) FILTER (WHERE completed))::int
        FROM view_events
        WHERE started_at >= ${s.liveStart}::timestamptz AND started_at < ${s.liveEnd}::timestamptz
          AND ${s.liveIncluded}
        ORDER BY day`),
    );
    const byDay = new Map(rows.map((row) => [row.day, row]));
    const out: Array<{
      day: string;
      views: number;
      uniques: number;
      watchMs: number;
      completions: number;
    }> = [];
    for (let day = range.from; day <= range.to; day = addDays(day, 1)) {
      const row = byDay.get(day);
      out.push({
        day,
        views: num(row?.views),
        uniques: num(row?.uniques),
        watchMs: num(row?.watch_ms),
        completions: num(row?.completions),
      });
    }
    return out;
  }

  const totals = (days: Awaited<ReturnType<typeof siteDaily>>): PeriodTotals => {
    const views = days.reduce((sum, d) => sum + d.views, 0);
    const uniqueViewers = days.reduce((sum, d) => sum + d.uniques, 0);
    const watchMs = days.reduce((sum, d) => sum + d.watchMs, 0);
    const completions = days.reduce((sum, d) => sum + d.completions, 0);
    return {
      views,
      uniqueViewers,
      watchMs,
      avgWatchMsPerViewer: ratio(watchMs, uniqueViewers),
      completionRate: ratio(completions, views),
    };
  };

  return {
    async overview(range: DayRange): Promise<OverviewResult> {
      return cached(`overview:${range.from}:${range.to}`, async () => {
        const [current, previous] = await Promise.all([
          siteDaily(range),
          siteDaily(previousPeriod(range)),
        ]);
        return {
          range,
          current: totals(current),
          previous: totals(previous),
          daily: current.map(({ day, views, watchMs }) => ({ day, views, watchMs })),
        };
      });
    },

    async topTitles(
      range: DayRange,
      opts: {
        includeArchived?: boolean;
        sort?: 'views' | 'watchMs' | 'completionRate' | 'avgPercentWatched';
        limit?: number;
      },
    ): Promise<TopTitle[]> {
      return cached(
        `top:${range.from}:${range.to}:${opts.includeArchived}:${opts.sort}:${opts.limit}`,
        async () => {
          const s = split(range);
          const rows = rowsOf<{
            id: string;
            title: string;
            views: string;
            watch_ms: string;
            completions: string;
            duration_ms: number | null;
          }>(
            await db.execute(sql`
            WITH combined AS (
              SELECT video_id, views, watch_ms, completions FROM video_daily_stats
              WHERE day BETWEEN ${s.rolledFrom}::date AND ${s.rolledTo}::date
              UNION ALL
              SELECT video_id, count(*)::int, COALESCE(sum(watched_ms), 0)::bigint, (count(*) FILTER (WHERE completed))::int
              FROM view_events
              WHERE started_at >= ${s.liveStart}::timestamptz AND started_at < ${s.liveEnd}::timestamptz
                AND ${s.liveIncluded}
              GROUP BY video_id
            )
            SELECT v.id, v.title, v.duration_ms, sum(c.views) AS views, sum(c.watch_ms) AS watch_ms,
                   sum(c.completions) AS completions
            FROM combined c JOIN videos v ON v.id = c.video_id
            WHERE (${opts.includeArchived === true} OR v.deleted_at IS NULL)
            GROUP BY v.id, v.title, v.duration_ms`),
          );
          const list = rows.map((row): TopTitle => {
            const views = num(row.views);
            const watchMs = num(row.watch_ms);
            return {
              videoId: row.id,
              title: row.title,
              views,
              watchMs,
              completionRate: ratio(num(row.completions), views),
              avgPercentWatched: row.duration_ms
                ? ratio(watchMs, views * row.duration_ms) * 100
                : 0,
            };
          });
          const key = opts.sort ?? 'views';
          list.sort((a, b) => b[key] - a[key] || a.title.localeCompare(b.title));
          return list.slice(0, opts.limit ?? 50);
        },
      );
    },

    /** Lifetime rating counts per video, from the ratings rollup. Titles with no ratings row are left out. */
    async ratingTotals(videoIds: readonly string[]): Promise<Map<string, RatingTotals>> {
      if (videoIds.length === 0) return new Map();
      const rows = rowsOf<{ video_id: string; likes: number; loves: number; dislikes: number }>(
        await db.execute(sql`
          SELECT video_id, likes, loves, dislikes FROM title_rating_stats
          WHERE video_id IN (${sql.join(
            videoIds.map((id) => sql`${id}::uuid`),
            sql`, `,
          )})`),
      );
      return new Map(
        rows.map((row) => [
          row.video_id,
          { likes: num(row.likes), loves: num(row.loves), dislikes: num(row.dislikes) },
        ]),
      );
    },

    /** Every title with views on each day of the range: rolled up days plus live rows for today. Not cached, not limited. */
    async titleDaily(range: DayRange): Promise<TitleDailyRow[]> {
      const s = split(range);
      const rows = rowsOf<{
        day: string;
        video_id: string;
        title: string;
        archived: boolean;
        views: string;
        watch_ms: string;
        completions: string;
        likes: number | null;
        loves: number | null;
        dislikes: number | null;
      }>(
        await db.execute(sql`
          WITH combined AS (
            SELECT to_char(day, 'YYYY-MM-DD') AS day, video_id, views, watch_ms, completions
            FROM video_daily_stats
            WHERE day BETWEEN ${s.rolledFrom}::date AND ${s.rolledTo}::date
            UNION ALL
            SELECT ${s.today}, video_id, count(*)::int, COALESCE(sum(watched_ms), 0)::bigint,
                   (count(*) FILTER (WHERE completed))::int
            FROM view_events
            WHERE started_at >= ${s.liveStart}::timestamptz AND started_at < ${s.liveEnd}::timestamptz
              AND ${s.liveIncluded}
            GROUP BY video_id
          )
          SELECT c.day, c.video_id, v.title, (v.deleted_at IS NOT NULL) AS archived,
                 c.views, c.watch_ms, c.completions, r.likes, r.loves, r.dislikes
          FROM combined c JOIN videos v ON v.id = c.video_id
          LEFT JOIN title_rating_stats r ON r.video_id = c.video_id
          WHERE c.views > 0 OR c.watch_ms > 0
          ORDER BY c.day, v.title, c.video_id`),
      );
      return rows.map((row) => {
        const base: TitleDailyRow = {
          day: row.day,
          videoId: row.video_id,
          title: row.title,
          archived: Boolean(row.archived),
          views: num(row.views),
          watchMs: num(row.watch_ms),
          completions: num(row.completions),
        };
        if (row.likes === null || row.likes === undefined) return base;
        const totals = { likes: num(row.likes), loves: num(row.loves), dislikes: num(row.dislikes) };
        return { ...base, ...totals, positiveShare: positiveShare(totals) };
      });
    },

    /** Daily views and a retention curve for one video. The curve needs raw rows, so it covers the raw retention window. */
    async videoDetail(videoId: string, range: DayRange) {
      return cached(`video:${videoId}:${range.from}:${range.to}`, async () => {
        const s = split(range);
        const dailyRows = rowsOf<{ day: string; views: number; watch_ms: string }>(
          await db.execute(sql`
            SELECT to_char(day, 'YYYY-MM-DD') AS day, views, watch_ms FROM video_daily_stats
            WHERE video_id = ${videoId}::uuid AND day BETWEEN ${s.rolledFrom}::date AND ${s.rolledTo}::date
            UNION ALL
            SELECT ${s.today}, count(*)::int, COALESCE(sum(watched_ms), 0)::bigint FROM view_events
            WHERE video_id = ${videoId}::uuid AND ${s.liveIncluded}
              AND started_at >= ${s.liveStart}::timestamptz AND started_at < ${s.liveEnd}::timestamptz
            ORDER BY day`),
        );
        const byDay = new Map(dailyRows.map((row) => [row.day, row]));
        const daily: Array<{ day: string; views: number; watchMs: number }> = [];
        for (let day = range.from; day <= range.to; day = addDays(day, 1)) {
          const row = byDay.get(day);
          daily.push({ day, views: num(row?.views), watchMs: num(row?.watch_ms) });
        }

        const bounds = {
          start: dayBounds(range.from).start.toISOString(),
          end: dayBounds(range.to).end.toISOString(),
        };
        const curve = rowsOf<{ bucket: number; still: string; total: string }>(
          await db.execute(sql`
            SELECT g.i AS bucket,
                   count(*) FILTER (WHERE e.watched_ms >= g.i * v.duration_ms / ${RETENTION_POINTS}::float8) AS still,
                   count(*) AS total
            FROM videos v
            JOIN view_events e ON e.video_id = v.id
              AND e.started_at >= ${bounds.start}::timestamptz AND e.started_at < ${bounds.end}::timestamptz
            CROSS JOIN generate_series(0, ${RETENTION_POINTS - 1}) AS g(i)
            WHERE v.id = ${videoId}::uuid AND v.duration_ms IS NOT NULL
            GROUP BY g.i ORDER BY g.i`),
        );
        const retention: RetentionPoint[] = curve.map((row) => ({
          atPercent: (num(row.bucket) * 100) / RETENTION_POINTS,
          percent: ratio(num(row.still), num(row.total)) * 100,
        }));
        return { videoId, range, daily, retention };
      });
    },

    /** Device, connection and country shares. Small groups are merged into Other. */
    async audienceSplits(range: DayRange) {
      return cached(`splits:${range.from}:${range.to}`, async () => {
        const rows = rowsOf<{ kind: string; key: string; total: string }>(
          await db.execute(sql`
            SELECT kind, key, sum(count) AS total FROM analytics_counters
            WHERE kind IN ('device', 'connection', 'country') AND day BETWEEN ${range.from}::date AND ${range.to}::date
            GROUP BY kind, key`),
        );
        const group = (kind: string) =>
          Object.fromEntries(
            rows.filter((row) => row.kind === kind).map((row) => [row.key, num(row.total)]),
          );
        return {
          device: buildSplit(group('device')),
          connection: buildSplit(group('connection')),
          country: buildSplit(group('country')),
        };
      });
    },

    /** Shares per channel across the catalog. Counters only, no person is recorded (L15a). */
    async shareTotals(range: DayRange): Promise<ShareCount[]> {
      return cached(`shares:${range.from}:${range.to}`, async () =>
        shareRows(
          rowsOf<{ key: string; total: string }>(
            await db.execute(sql`
              SELECT key, sum(count) AS total FROM analytics_counters
              WHERE kind = 'share' AND day BETWEEN ${range.from}::date AND ${range.to}::date
              GROUP BY key`),
          ),
        ),
      );
    },

    /** Shares per channel for one title (L15a). */
    async titleShares(titleId: string, range: DayRange): Promise<ShareCount[]> {
      const prefix = `${titleId}|`;
      return shareRows(
        rowsOf<{ key: string; total: string }>(
          await db.execute(sql`
            SELECT substr(key, ${prefix.length + 1}) AS key, sum(count) AS total
            FROM analytics_counters
            WHERE kind = 'share_item' AND left(key, ${prefix.length}) = ${prefix}
              AND day BETWEEN ${range.from}::date AND ${range.to}::date
            GROUP BY 1`),
        ),
      );
    },

    /** Searches that found nothing, most frequent first (M19, Could). */
    async emptySearches(range: DayRange, limit = 20) {
      const rows = rowsOf<{ key: string; total: string }>(
        await db.execute(sql`
          SELECT key, sum(count) AS total FROM analytics_counters
          WHERE kind = 'search_empty' AND day BETWEEN ${range.from}::date AND ${range.to}::date
          GROUP BY key ORDER BY total DESC, key LIMIT ${limit}`),
      );
      return rows.map((row) => ({ query: row.key, count: num(row.total) }));
    },

    /** Startup percentiles, rebuffer ratio, errors by code and vitals (M24-S04). */
    async playerQuality(
      range: DayRange,
      filter: { deviceClass?: string; saveData?: boolean } = {},
    ) {
      return cached(
        `quality:${range.from}:${range.to}:${filter.deviceClass}:${filter.saveData}`,
        async () => {
          const rows = rowsOf<{ kind: string; key: string; total: string }>(
            await db.execute(sql`
            SELECT kind, key, sum(count) AS total FROM analytics_counters
            WHERE day BETWEEN ${range.from}::date AND ${range.to}::date
              AND (kind LIKE 'vitals\\_%' OR kind IN ('startup', 'error', 'rebuffer_ms'))
            GROUP BY kind, key`),
          );
          const matches = (key: string): boolean => {
            const [, device, connection] = key.split('|');
            if (filter.deviceClass && device !== filter.deviceClass) return false;
            if (
              filter.saveData !== undefined &&
              connection !== (filter.saveData ? 'save_data' : 'std')
            )
              return false;
            return true;
          };
          const histogram = (kind: string) => {
            const out: Record<string, number> = {};
            for (const row of rows) {
              if (row.kind !== kind || !matches(row.key)) continue;
              const bucket = row.key.split('|')[0]!;
              out[bucket] = (out[bucket] ?? 0) + num(row.total);
            }
            return out;
          };
          const startup = histogram('startup');
          const vitals: Record<string, number | null> = {};
          for (const name of ['LCP', 'INP', 'CLS', 'FCP', 'TTFB']) {
            vitals[name] = percentileFromBuckets(histogram(`vitals_${name}`), 0.75);
          }
          const watched = rowsOf<{ ms: string }>(
            await db.execute(sql`
            SELECT COALESCE(sum(watch_ms), 0) AS ms FROM site_daily_stats
            WHERE day BETWEEN ${range.from}::date AND ${range.to}::date`),
          );
          const rebufferMs = rows
            .filter((r) => r.kind === 'rebuffer_ms')
            .reduce((sum, r) => sum + num(r.total), 0);
          return {
            startupP50Ms: percentileFromBuckets(startup, 0.5),
            startupP75Ms: percentileFromBuckets(startup, 0.75),
            rebufferRatio: ratio(rebufferMs, num(watched[0]?.ms)),
            errorsByCode: rows
              .filter((r) => r.kind === 'error')
              .map((r) => ({ code: r.key, count: num(r.total) }))
              .sort((a, b) => b.count - a.count),
            vitalsP75: vitals,
          };
        },
      );
    },
  };
}

export type AnalyticsQueries = ReturnType<typeof createAnalyticsQueries>;
