import 'server-only';
import { createAnalyticsQueries } from '@ad/analytics';
import type { DayRange } from '@ad/analytics';
import { getServices } from '@/lib/runtime/services';
import type { AnalyticsOverview, VideoAnalytics } from './analytics-rules';

let queries: ReturnType<typeof createAnalyticsQueries> | undefined;
const q = () => (queries ??= createAnalyticsQueries(getServices().db, { cacheTtlMs: 60_000 }));

/** Production reads. Same result shapes as the fixture, so the screens do not change. */
export const realAnalytics = {
  async overview(range: DayRange): Promise<AnalyticsOverview> {
    const [overview, top, splits] = await Promise.all([
      q().overview(range),
      q().topTitles(range, { sort: 'views', limit: 10 }),
      q().audienceSplits(range),
    ]);
    return { ...overview, top, splits };
  },
  exportRows: (range: DayRange) => q().titleDaily(range),
  async video(id: string, range: DayRange): Promise<VideoAnalytics | null> {
    const [detail, titles] = await Promise.all([
      q().videoDetail(id, range),
      q().topTitles(range, { includeArchived: true, sort: 'views', limit: 500 }),
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
    };
  },
};
