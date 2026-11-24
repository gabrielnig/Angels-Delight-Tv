'use client';

import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { cx } from './cx';

export const SKELETON_DELAY_MS = 300;

export function Skeleton({
  width,
  height,
  radius,
  circle,
  className,
  style,
}: {
  width?: string;
  height?: string;
  radius?: string;
  circle?: boolean;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <span
      className={cx('ad-skeleton', className)}
      aria-hidden="true"
      style={{
        width,
        height,
        borderRadius: circle ? 'var(--radius-circle)' : radius,
        ...style,
      }}
    />
  );
}

/**
 * Wraps skeleton shapes. Renders nothing for the first 300ms so quick loads never flash,
 * then shows the shapes with aria-busy and a visually hidden label.
 */
export function SkeletonRegion({
  label = 'Loading',
  delayMs = SKELETON_DELAY_MS,
  children,
  className,
}: {
  label?: string;
  delayMs?: number;
  children?: ReactNode;
  className?: string;
}) {
  const [visible, setVisible] = useState(delayMs <= 0);
  useEffect(() => {
    if (delayMs <= 0) return;
    const timer = setTimeout(() => setVisible(true), delayMs);
    return () => clearTimeout(timer);
  }, [delayMs]);

  return (
    <div className={cx('ad-skeleton-region', className)} aria-busy={visible ? 'true' : undefined}>
      {visible ? (
        <>
          <span className="ad-sr-only">{label}</span>
          {children}
        </>
      ) : null}
    </div>
  );
}

export function SkeletonCard() {
  return (
    <div className="ad-skelcard" aria-hidden="true">
      <Skeleton className="ad-skelcard__thumb" />
      <Skeleton className="ad-skelcard__title" width="90%" />
      <Skeleton className="ad-skelcard__title" width="55%" />
      <Skeleton className="ad-skelcard__meta" width="40%" />
    </div>
  );
}

export function SkeletonRow({ count = 6 }: { count?: number }) {
  return (
    <div className="ad-skelrow" aria-hidden="true">
      {Array.from({ length: count }, (_, index) => (
        <SkeletonCard key={index} />
      ))}
    </div>
  );
}
