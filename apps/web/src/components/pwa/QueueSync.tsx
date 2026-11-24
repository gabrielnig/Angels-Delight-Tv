'use client';

import { useT } from '../../lib/i18n/provider';
import { useEffect, useState } from 'react';
import './pwa.css';
import { createWriteQueue } from '../../lib/pwa/write-queue';

/** Sends the offline queue of this profile when the page opens online and whenever the network returns (M25-S05). */
export function QueueSync({ profileId }: { profileId: string }) {
  const msg = useT();
  const [notice, setNotice] = useState(false);
  useEffect(() => {
    const flush = () => {
      if (!navigator.onLine) return;
      void createWriteQueue(localStorage)
        .flush(profileId, async (item) => {
          const response = await fetch(item.url, {
            method: item.method,
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(item.body),
          });
          return response.status;
        })
        .then((result) => {
          if (result.dropped > 0) setNotice(true);
        });
    };
    flush();
    window.addEventListener('online', flush);
    return () => window.removeEventListener('online', flush);
  }, [profileId]);
  // Told once per run, and it goes away by itself (M25-S05).
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(false), 8000);
    return () => clearTimeout(timer);
  }, [notice]);
  return notice ? (
    <div className="pwa-toast" role="status">
      {msg('pwa.someChangesYouMade')}
    </div>
  ) : null;
}
