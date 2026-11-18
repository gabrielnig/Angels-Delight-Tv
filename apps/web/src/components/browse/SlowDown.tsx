'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

/** Shown when search is rate limited: the wait counts down, then the page asks again (M06-S10). */
export function SlowDown({ seconds, onReady }: { seconds: number; onReady: () => void }) {
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
      Slow down a little. Try again in {Math.max(left, 1)} {left === 1 ? 'second' : 'seconds'}.
    </p>
  );
}

/** The version for pages: refreshes the route when the wait is over. */
export function SlowDownRefresh({ seconds }: { seconds: number }) {
  const router = useRouter();
  return <SlowDown seconds={seconds} onReady={() => router.refresh()} />;
}
