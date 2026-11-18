'use client';

import { useEffect } from 'react';
import { TitleError } from '../../../../components/title/TitleStates';
import { getAnalyticsClient } from '../../../../lib/analytics/browser';

/** The digest is the server log reference (M24-S01 AC2). Raw messages are never shown. */
export default function TitleErrorPage({
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
  return <TitleError reference={error.digest} onRetry={reset} />;
}
