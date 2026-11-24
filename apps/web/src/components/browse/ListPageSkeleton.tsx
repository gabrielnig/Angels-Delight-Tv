'use client';

import { Skeleton, SkeletonCard, SkeletonRegion } from '@ad/ui';

/**
 * Loading state for the View all list pages. It uses the real grid class so the columns match
 * the loaded page, and the region reserves height so nothing shifts when cards arrive (11.14).
 */
export function ListPageSkeleton({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="web-page">
      <SkeletonRegion label={label} className="web-list-skeleton">
        <div aria-hidden="true">
          <Skeleton className="web-list-skeleton__title" width="40%" />
          <Skeleton className="web-list-skeleton__count" width="6rem" />
          <ul className="web-grid">
            {Array.from({ length: 10 }, (_, index) => (
              <li key={index}>
                <SkeletonCard />
              </li>
            ))}
          </ul>
        </div>
      </SkeletonRegion>
    </div>
  );
}
