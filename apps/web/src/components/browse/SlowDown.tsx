'use client';

import { useT } from '../../lib/i18n/provider';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

/** Shown when search is rate limited: the wait counts down, then the page asks again (M06-S10). */
export function SlowDown({ seconds, onReady }: { seconds: number; onReady: () => void }) {
  const msg = useT();
  const start = Math.min(60, Math.max(1, Math.ceil(seconds)));
  const [left, setLeft] = useState(start);
  useEffect(() => setLeft(start), [start]);
  useEffect(() => {
    if (left <= 0) {
      onReady();
      return;
    }
    const timer = setTimeout(() => setLeft((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [left, onReady]);
  return (
    <p role="status" className="web-slowdown">
      {msg('browse.slowDown', { count: Math.max(left, 1) })}
    </p>
  );
}

/** The version for pages: refreshes the route when the wait is over. */
export function SlowDownRefresh({ seconds }: { seconds: number }) {
  const router = useRouter();
  return <SlowDown seconds={seconds} onReady={() => router.refresh()} />;
}
