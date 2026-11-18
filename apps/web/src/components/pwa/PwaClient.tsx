'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { createWriteQueue } from '@/lib/pwa/write-queue';
import { registerServiceWorker, type RegisterHandle } from '@/lib/pwa/register';
import { ConnectionStatus } from './ConnectionStatus';
import { InstallPrompt } from './InstallPrompt';
import './pwa.css';

/** True while any media element is playing, so an update never lands mid video. */
const videoIsPlaying = () =>
  Array.from(document.querySelectorAll('video')).some((v) => !v.paused && !v.ended);

/**
 * Mount once in the root layout. Registers the service worker, shows connection state, the install prompt
 * and the "Updated" notice. Web vitals reporting is mounted separately (`WebVitals`).
 */
export function PwaClient({
  platformName,
  profileId = null,
}: {
  platformName: string;
  profileId?: string | null;
}) {
  const pathname = usePathname();
  const handle = useRef<RegisterHandle | null>(null);
  const [updated, setUpdated] = useState(false);

  useEffect(() => {
    void registerServiceWorker({
      serviceWorker: 'serviceWorker' in navigator ? navigator.serviceWorker : undefined,
      isPlaying: videoIsPlaying,
      onUpdated: () => {
        setUpdated(true);
        setTimeout(() => setUpdated(false), 4000);
      },
    }).then((result) => (handle.current = result));
    const onHide = () =>
      document.visibilityState === 'hidden' && handle.current?.applyUpdateIfSafe();
    document.addEventListener('visibilitychange', onHide);
    return () => document.removeEventListener('visibilitychange', onHide);
  }, []);

  useEffect(() => handle.current?.applyUpdateIfSafe(), [pathname]);

  const syncQueue = () => {
    if (!profileId) return;
    void createWriteQueue(localStorage).flush(profileId, async (item) => {
      const response = await fetch(item.url, {
        method: item.method,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(item.body),
      });
      return response.status;
    });
  };

  return (
    <>
      <ConnectionStatus onBackOnline={syncQueue} />
      <InstallPrompt platformName={platformName} />
      {updated ? (
        <div className="pwa-toast" role="status">
          Updated
        </div>
      ) : null}
    </>
  );
}
