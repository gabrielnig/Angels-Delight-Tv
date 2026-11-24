'use client';

import { Children, useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { IconButton } from './Button';
import { cx } from './cx';
import { Link } from './Link';
import { SkeletonRegion, SkeletonRow } from './Skeleton';
import { ErrorState } from './States';

export type RowState = 'ready' | 'loading' | 'error';

export function Row({
  title,
  seeAllHref,
  state = 'ready',
  onRetry,
  empty,
  skeletonDelayMs,
  children,
  className,
}: {
  title: string;
  seeAllHref?: string;
  state?: RowState;
  onRetry?: () => void;
  /** Shown instead of hiding the row when it has no cards (My List only). */
  empty?: ReactNode;
  skeletonDelayMs?: number;
  children?: ReactNode;
  className?: string;
}) {
  const headingId = useId();
  const listRef = useRef<HTMLUListElement>(null);
  const [edges, setEdges] = useState({ prev: false, next: false });
  const items = Children.toArray(children);

  const measure = useCallback(() => {
    const list = listRef.current;
    if (!list) return;
    const prev = list.scrollLeft > 4;
    const next = list.scrollLeft + list.clientWidth < list.scrollWidth - 4;
    setEdges((current) =>
      current.prev === prev && current.next === next ? current : { prev, next },
    );
  }, []);

  useEffect(() => {
    measure();
    const list = listRef.current;
    if (!list || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(list);
    return () => observer.disconnect();
  }, [measure, items.length, state]);

  function page(direction: 1 | -1) {
    const list = listRef.current;
    if (!list) return;
    const card = (list.firstElementChild as HTMLElement | null)?.offsetWidth ?? 0;
    const distance = Math.max(card, list.clientWidth - card);
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    list.scrollBy({ left: direction * distance, behavior: reduce ? 'auto' : 'smooth' });
  }

  if (state === 'ready' && items.length === 0 && !empty) return null;

  return (
    <section className={cx('ad-row', className)} aria-labelledby={headingId}>
      <div className="ad-row__head">
        <h2 id={headingId} className="ad-row__title">
          {title}
        </h2>
        {seeAllHref && state === 'ready' ? (
          <Link href={seeAllHref} className="ad-row__all" aria-label={`See all ${title}`}>
            See all
          </Link>
        ) : null}
      </div>

      {state === 'loading' ? (
        <SkeletonRegion label={`Loading ${title}`} delayMs={skeletonDelayMs}>
          <SkeletonRow />
        </SkeletonRegion>
      ) : null}

      {state === 'error' ? (
        <div className="ad-row__pad">
          <ErrorState title="Could not load this row." description="Try again." onRetry={onRetry} />
        </div>
      ) : null}

      {state === 'ready' && items.length === 0 ? <div className="ad-row__pad">{empty}</div> : null}

      {state === 'ready' && items.length > 0 ? (
        <div className="ad-row__viewport">
          {edges.prev ? (
            <IconButton
              className="ad-row__arrow ad-row__arrow--prev"
              variant="surface"
              icon="chevronLeft"
              label="Previous titles"
              onClick={() => page(-1)}
            />
          ) : null}
          <ul ref={listRef} className="ad-row__list" role="list" onScroll={measure}>
            {items.map((child, index) => (
              <li key={index} className="ad-row__item">
                {child}
              </li>
            ))}
          </ul>
          {edges.next ? (
            <IconButton
              className="ad-row__arrow ad-row__arrow--next"
              variant="surface"
              icon="chevronRight"
              label="Next titles"
              onClick={() => page(1)}
            />
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
