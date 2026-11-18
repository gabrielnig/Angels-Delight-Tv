'use client';

import { useEffect, useRef, useState } from 'react';
import './pwa.css';

/** Offline banner (S34 state 1) and a short "back online" toast (state 3). */
export function ConnectionStatus({
  onBackOnline,
  initialOnline = true,
  toastMs = 4000,
  savedView = false,
}: {
  onBackOnline?: () => void;
  initialOnline?: boolean;
  toastMs?: number;
  /** Home keeps its last rows on the device, so the banner says that instead of a generic warning (M05-S08). */
  savedView?: boolean;
}) {
  const [online, setOnline] = useState(initialOnline);
  const [toast, setToast] = useState(false);
  const wasOffline = useRef(!initialOnline);
  const callback = useRef(onBackOnline);
  callback.current = onBackOnline;

  useEffect(() => {
    setOnline(navigator.onLine);
    wasOffline.current = !navigator.onLine;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const goOffline = () => {
      wasOffline.current = true;
      setOnline(false);
    };
    const goOnline = () => {
      setOnline(true);
      if (!wasOffline.current) return;
      wasOffline.current = false;
      setToast(true);
      callback.current?.();
      timer = setTimeout(() => setToast(false), toastMs);
    };
    window.addEventListener('offline', goOffline);
    window.addEventListener('online', goOnline);
    return () => {
      window.removeEventListener('offline', goOffline);
      window.removeEventListener('online', goOnline);
      if (timer) clearTimeout(timer);
    };
  }, [toastMs]);

  return (
    <>
      {!online ? (
        <div className="pwa-status" role="status">
          <span>
            {savedView
              ? 'You are offline. Showing the view saved on this device.'
              : 'You are offline. Check your data or Wi-Fi.'}
          </span>
          <button type="button" className="pwa-btn" onClick={() => window.location.reload()}>
            Retry
          </button>
        </div>
      ) : null}
      {toast ? (
        <div className="pwa-toast" role="status">
          <strong>You are back online</strong>
          <div>Playback and saved changes carry on.</div>
        </div>
      ) : null}
    </>
  );
}
