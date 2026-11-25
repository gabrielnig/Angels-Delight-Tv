import { getAnalyticsClient } from '../../lib/analytics/browser';
import type { ShareTargetId } from './share-targets';

/**
 * One anonymous count when someone picks a place in the Share sheet (L15a, D-391). It carries the place and whether it
 * was a video or a series, never the link, the title or any text. The browser client drops it under Global Privacy
 * Control or Do Not Track. A blocked or failing client never gets in the way of sharing.
 */
export function trackShare(channel: ShareTargetId, titleKind: 'video' | 'series'): void {
  try {
    getAnalyticsClient().track({ kind: 'share', channel, titleKind });
  } catch {
    // counting is optional
  }
}
