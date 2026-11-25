'use client';

import { useEffect, useRef, type ReactNode } from 'react';

/** "On this page". Open on wide screens, a closed dropdown on narrow ones. Open without script, so it works printed or offline. */
export function TocDetails({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const wide = window.matchMedia('(min-width: 80rem)');
    const sync = () => ref.current?.toggleAttribute('open', wide.matches);
    sync();
    wide.addEventListener('change', sync);
    return () => wide.removeEventListener('change', sync);
  }, []);
  return (
    <details ref={ref} open className="hlp-toc__box">
      <summary>On this page</summary>
      {children}
    </details>
  );
}
