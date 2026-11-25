'use client';

import { Skeleton, SkeletonCard, SkeletonRegion } from '@ad/ui';

/**
 * Loading state under the Browse rail and bar. It uses the real grid, so the columns match the loaded page, and the
 * region reserves height so nothing shifts when cards arrive. Shapes appear after 300 ms (11.14).
 */
export function BrowseSkeleton({ label }: { label: string }) {
  return (
    <SkeletonRegion label={label} className="web-browse-skeleton">
      <div aria-hidden="true">
        <ul className="web-grid">
          {Array.from({ length: 10 }, (_, index) => (
            <li key={index}>
              <SkeletonCard />
            </li>
          ))}
        </ul>
      </div>
    </SkeletonRegion>
  );
}

/** The count placeholder beside the title while the first page loads. */
export function BrowseCountSkeleton() {
  return <Skeleton className="web-browse__count-skeleton" width="5.5rem" />;
}
