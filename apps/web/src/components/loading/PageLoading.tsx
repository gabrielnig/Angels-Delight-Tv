'use client';

import { Skeleton, SkeletonRegion, SkeletonRow } from '@ad/ui';

/** Route level loading state for viewer and account pages. Appears after 300ms, static under reduced motion. */
export function PageLoading({ label = 'Loading' }: { label?: string }) {
  return (
    <SkeletonRegion label={label}>
      <div className="web-page web-stack" aria-hidden="true">
        <Skeleton height="2rem" width="40%" />
        <SkeletonRow />
        <SkeletonRow />
      </div>
    </SkeletonRegion>
  );
}
