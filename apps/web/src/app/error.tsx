'use client';

import { useEffect } from 'react';
import { getAnalyticsClient } from '../lib/analytics/browser';
import '../components/pwa/pwa.css';

/** Route level error screen. The digest is the server log reference (M24-S01 AC2). Raw messages are never shown. */
export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    try {
      getAnalyticsClient().track({ kind: 'error', code: 'app.render' });
    } catch {
      // Reporting is best effort.
    }
  }, [error]);

  return (
    <main className="pwa-offline">
      <h1>Something went wrong</h1>
      <p>Please try again. If it keeps happening, tell us the reference below.</p>
      {error.digest ? <p>Reference: {error.digest}</p> : null}
      <button type="button" className="pwa-btn pwa-btn--primary" onClick={reset}>
        Try again
      </button>
      <a className="pwa-btn" href="/">
        Back to Home
      </a>
    </main>
  );
}
