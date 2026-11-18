import { VITAL_NAMES } from '@ad/analytics/client';
import type { AnalyticsEvent } from '@ad/analytics';

type VitalName = (typeof VITAL_NAMES)[number];
const SUPPORTED: readonly string[] = VITAL_NAMES;

/** First path segment only, lowercase. Keeps cardinality low and never carries slugs, ids or query strings. */
export function routeBucket(pathname: string): string {
  const first = pathname.split('?')[0]!.split('/').filter(Boolean)[0];
  return first && /^[a-z0-9-]+$/i.test(first) ? `/${first.toLowerCase()}` : '/';
}

export function vitalToEvent(
  metric: { name: string; value: number },
  pathname: string,
): Extract<AnalyticsEvent, { kind: 'vitals' }> | null {
  if (!SUPPORTED.includes(metric.name)) return null;
  return {
    kind: 'vitals',
    name: metric.name as VitalName,
    value: Math.min(Math.max(metric.value, 0), 600_000),
    route: routeBucket(pathname),
  };
}
