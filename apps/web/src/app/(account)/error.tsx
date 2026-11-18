'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { AccountFrame } from '../../components/account/AccountFrame';
import { AccountLoadError } from '../../components/account/AccountStates';
import { useSupportEmail } from '../../components/account/AccountSupport';
import { accountPageCopy } from '../../components/account/pages';
import { getAnalyticsClient } from '../../lib/analytics/browser';

/** S27 state 3. The digest is the server log reference, shown as ERR-XXXX-XXXX so a member can quote it. */
export function referenceFrom(digest: string | undefined): string | undefined {
  const clean = (digest ?? '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  if (clean.length < 4) return undefined;
  return `ERR-${clean.slice(0, 4)}-${clean.slice(4, 8).padEnd(4, '0')}`;
}

export default function AccountError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const copy = accountPageCopy(usePathname());
  const support = useSupportEmail();
  useEffect(() => {
    try {
      getAnalyticsClient().track({ kind: 'error', code: 'app.render' });
    } catch {
      // Reporting is best effort.
    }
  }, [error]);
  return (
    <AccountFrame title={copy.title} lead={copy.lead}>
      <AccountLoadError
        title={copy.errorTitle}
        supportEmail={support}
        reference={referenceFrom(error.digest)}
        onRetry={reset}
      />
    </AccountFrame>
  );
}
