'use client';

import { HelpErrorView } from '@/components/admin/help/HelpStates';

/** A help page failed to load (S198). The menu stays so the person can leave. */
export default function HelpError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <HelpErrorView digest={error.digest} reset={reset} />;
}
