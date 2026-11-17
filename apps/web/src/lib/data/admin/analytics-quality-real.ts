import 'server-only';
import { createAnalyticsQueries, lagosDay, addDays } from '@ad/analytics';
import { getServices } from '@/lib/runtime/services';
import type { Quality } from './system-rules';

/** Player quality for the last 7 days from the analytics counters. */
export async function realQuality(now: Date = new Date()): Promise<Quality> {
  const to = lagosDay(now);
  return createAnalyticsQueries(getServices().db, { cacheTtlMs: 60_000 }).playerQuality({
    from: addDays(to, -6),
    to,
  });
}
