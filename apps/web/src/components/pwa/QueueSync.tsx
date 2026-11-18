'use client';

import { useEffect } from 'react';
import { createWriteQueue } from '../../lib/pwa/write-queue';

/** Sends the offline queue of this profile when the page opens online and whenever the network returns (M25-S05). */
export function QueueSync({ profileId }: { profileId: string }) {
  useEffect(() => {
    const flush = () => {
      if (!navigator.onLine) return;
      void createWriteQueue(localStorage).flush(profileId, async (item) => {
        const response = await fetch(item.url, {
          method: item.method,
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(item.body),
        });
        return response.status;
      });
    };
    flush();
    window.addEventListener('online', flush);
    return () => window.removeEventListener('online', flush);
  }, [profileId]);
  return null;
}
