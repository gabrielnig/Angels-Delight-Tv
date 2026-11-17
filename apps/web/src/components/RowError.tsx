'use client';

import { useRouter } from 'next/navigation';
import { Row } from '@ad/ui';

/** Inline row failure. The rest of the page keeps working. */
export function RowError({ title }: { title: string }) {
  const router = useRouter();
  return <Row title={title} state="error" onRetry={() => router.refresh()} />;
}
