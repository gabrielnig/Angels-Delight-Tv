import 'server-only';
import { createAnalyticsQueries, monthChunks } from '@ad/analytics';
import type { DayRange } from '@ad/analytics';
import { getServices } from '@/lib/runtime/services';
import { INLINE_EXPORT_MAX } from './exports-rules';
import type { AnalyticsOverview, VideoAnalytics } from './analytics-rules';

let queries: ReturnType<typeof createAnalyticsQueries> | undefined;
const q = () => (queries ??= createAnalyticsQueries(getServices().db, { cacheTtlMs: 60_000 }));

/** Production reads. Same result shapes as the fixture, so the screens do not change. */
export const realAnalytics = {
  async overview(range: DayRange): Promise<AnalyticsOverview> {
    const [overview, top, splits, shares] = await Promise.all([
      q().overview(range),
      q().topTitles(range, { sort: 'views', limit: 10 }),
      q().audienceSplits(range),
      q().shareTotals(range),
    ]);
    const ratings = await q().ratingTotals(top.map((t) => t.videoId));
    return {
      ...overview,
      top: top.map((t) => (ratings.has(t.videoId) ? { ...t, ratings: ratings.get(t.videoId) } : t)),
      splits,
      shares,
    };
  },
  exportRows: (range: DayRange) => q().titleDaily(range),
  /** Rows the CSV would have, read a month at a time and stopped once it is past the inline limit. */
  async exportCount(range: DayRange): Promise<number> {
    let rows = 0;
    for (const chunk of monthChunks(range)) {
      rows += (await q().titleDaily(chunk)).length;
      if (rows > INLINE_EXPORT_MAX) break;
    }
    return rows;
  },
  async video(id: string, range: DayRange): Promise<VideoAnalytics | null> {
    const [detail, titles, shares] = await Promise.all([
      q().videoDetail(id, range),
      q().topTitles(range, { includeArchived: true, sort: 'views', limit: 500 }),
      q().titleShares(id, range),
    ]);
    const known = titles.find((t) => t.videoId === id);
    if (!known && detail.daily.every((d) => d.views === 0)) return null;
    return {
      videoId: id,
      title: known?.title ?? 'Video',
      range,
      daily: detail.daily,
      retention: detail.retention,
      totals: {
        views: detail.daily.reduce((n, d) => n + d.views, 0),
        watchMs: detail.daily.reduce((n, d) => n + d.watchMs, 0),
        completionRate: known?.completionRate ?? 0,
      },
      shares,
    };
  },
};
