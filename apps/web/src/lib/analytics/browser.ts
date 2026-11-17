'use client';

import { classifyDevice, createAnalyticsClient, type AnalyticsClient } from '@ad/analytics/client';
import { readConnection, type NavigatorLike } from '../lowdata/connection';

let client: AnalyticsClient | undefined;

/** One batching client per page, created on first use. Device class and Save-Data ride along once per batch. */
export function getAnalyticsClient(options: { preview?: boolean } = {}): AnalyticsClient {
  client ??= createAnalyticsClient({
    endpoint: '/api/analytics',
    deviceClass: classifyDevice(navigator.userAgent),
    saveData: readConnection(navigator as NavigatorLike).saveData,
    preview: options.preview,
  });
  return client;
}
