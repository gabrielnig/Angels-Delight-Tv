'use client';

import { classifyDevice, createAnalyticsClient, type AnalyticsClient } from '@ad/analytics/client';
import { allowEvent, type PrivacySignals } from '../consent/guard';
import { readConnection, type NavigatorLike } from '../lowdata/connection';

let client: AnalyticsClient | undefined;

/**
 * One batching client per page, created on first use. Device class and Save-Data ride along once per batch. Search
 * and share events are dropped when Global Privacy Control or Do Not Track is on (M45-S12); playback health stays.
 */
export function getAnalyticsClient(options: { preview?: boolean } = {}): AnalyticsClient {
  if (!client) {
    const inner = createAnalyticsClient({
      endpoint: '/api/analytics',
      deviceClass: classifyDevice(navigator.userAgent),
      saveData: readConnection(navigator as NavigatorLike).saveData,
      preview: options.preview,
    });
    client = {
      ...inner,
      track: (event) => {
        if (allowEvent(event.kind, navigator as unknown as PrivacySignals)) inner.track(event);
      },
    };
  }
  return client;
}
