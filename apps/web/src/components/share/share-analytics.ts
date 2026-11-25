import { getAnalyticsClient } from '../../lib/analytics/browser';
import type { ShareTargetId } from './share-targets';

/**
 * One anonymous count when someone picks a place in the Share sheet (L15a, D-391). It carries the place, whether it
 * was a video or a series and the catalog id when it is a real one, never the link, the title or any text. The browser client drops it under Global Privacy
 * Control or Do Not Track. A blocked or failing client never gets in the way of sharing.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function trackShare(channel: ShareTargetId, titleKind: 'video' | 'series', titleId?: string): void {
  try {
    getAnalyticsClient().track({
      kind: 'share',
      channel,
      titleKind,
      ...(titleId && UUID.test(titleId) ? { titleId } : {}),
    });
  } catch {
    // counting is optional
  }
}
