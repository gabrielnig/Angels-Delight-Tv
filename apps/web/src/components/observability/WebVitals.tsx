'use client';

import { usePathname } from 'next/navigation';
import { useReportWebVitals } from 'next/web-vitals';
import { vitalToEvent } from '@/lib/analytics/vitals';
import { getAnalyticsClient } from '@/lib/analytics/browser';

/** Sends Core Web Vitals to the same batched, privacy safe pipe as play events. Renders nothing. */
export function WebVitals() {
  const pathname = usePathname();
  useReportWebVitals((metric) => {
    const event = vitalToEvent(metric, pathname ?? '/');
    if (event) getAnalyticsClient().track(event);
  });
  return null;
}
