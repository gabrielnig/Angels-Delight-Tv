'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { Button } from './Button';

/** Re-runs the server render of the current page. Used by tile and table error states. */
export function RetryButton({ label = 'Retry' }: { label?: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button variant="secondary" icon="retry" loading={pending} onClick={() => start(() => router.refresh())}>
      {label}
    </Button>
  );
}
