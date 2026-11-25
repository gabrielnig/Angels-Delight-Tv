'use client';

import { PageHeader } from '@/components/admin/PageHeader';
import { ErrorState } from '@/components/admin/states';

export default function HelpError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <>
      <PageHeader
        crumbs={[{ label: 'Admin', href: '/admin' }, { label: 'Help centre' }]}
        title="Help centre"
      />
      <ErrorState
        title="We could not load the help centre."
        help="Nothing was changed. Try again in a moment."
        onRetry={reset}
      />
    </>
  );
}
