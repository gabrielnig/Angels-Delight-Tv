'use client';

import { useT } from '../lib/i18n/provider';
import { useEffect } from 'react';
import { useSupportEmail } from '../components/account/AccountSupport';
import { ErrorPage } from '../components/errors/ErrorPage';
import { getAnalyticsClient } from '../lib/analytics/browser';

/** Route level error screen (S139 state 4). The digest is the server log reference (M24-S01 AC2). Raw messages are never shown. */
export default function ErrorRoute({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const msg = useT();
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
      title={msg('errors.somethingWentWrongOn')}
      description="Try again in a moment. Your list and history are safe."
      supportEmail={supportEmail}
      {...(error.digest ? { reference: error.digest } : {})}
      action={{ label: msg('errors.tryAgain'), onClick: reset }}
    />
  );
}
