'use client';

import { useEffect } from 'react';
import { createSponsorTracker } from '@ad/analytics/client';
import { getAnalyticsClient } from '../../lib/analytics/browser';

const TRACKED = 'sponsorTracked';

/**
 * Starts the viewable impression tracker for every sponsor card on the page (M48-S15). The server renders a
 * card only for adults, so there is nothing to track for kids. Each impression joins the analytics batch and
 * also tells the server to count it against the day or session cap.
 */
export function SponsorTrackerMount() {
  useEffect(() => {
    const cards = Array.from(document.querySelectorAll<HTMLElement>('[data-creative]')).filter(
      (el) => !el.dataset[TRACKED],
    );
    if (cards.length === 0 || typeof IntersectionObserver === 'undefined') return;
    const tracker = createSponsorTracker({
      kids: false,
      send: (event) => {
        getAnalyticsClient().track(event);
        void fetch('/api/sponsors/seen', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ creativeId: event.creativeId, slot: event.slot }),
          keepalive: true,
        }).catch(() => undefined);
      },
      createObserver: (callback, options) =>
        new IntersectionObserver((entries) => callback(entries), options),
      isHidden: () => document.visibilityState === 'hidden',
      newId: () => crypto.randomUUID(),
    });
    for (const card of cards) {
      card.dataset[TRACKED] = '1';
      tracker.track(card);
    }
  }, []);
  return null;
}
