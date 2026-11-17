'use client';

import { ErrorState } from '@/components/admin/states';

/** Page level failure: says what happened and offers a retry (DESIGN-SYSTEM 11.21). */
export default function AdminError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <ErrorState
      title="This page could not load."
      help="Something went wrong on our side. Your videos are safe. Try again in a moment."
      onRetry={reset}
      reference={error.digest ? `AD-${error.digest.slice(0, 4).toUpperCase()}` : undefined}
    />
  );
}
