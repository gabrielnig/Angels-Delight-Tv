'use client';

import { useEffect } from 'react';
import { useSupportEmail } from '../../../../components/account/AccountSupport';
import { ErrorPage } from '../../../../components/errors/ErrorPage';
import { getAnalyticsClient } from '../../../../lib/analytics/browser';

/** The digest is the server log reference (M24-S01 AC2). Raw messages are never shown. One action (R39). */
export default function TitleErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const supportEmail = useSupportEmail();
  useEffect(() => {
    try {
      getAnalyticsClient().track({ kind: 'error', code: 'app.render' });
    } catch {
      // Reporting is best effort.
    }
  }, [error]);
  return (
    <ErrorPage
      title="We could not load this video"
      description="Something went wrong on our side. Your place in the video is safe."
      supportEmail={supportEmail}
      {...(error.digest ? { reference: error.digest } : {})}
      action={{ label: 'Try again', onClick: reset }}
    />
  );
}
