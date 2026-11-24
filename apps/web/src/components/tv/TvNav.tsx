'use client';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { TV_EVENT } from '../../lib/tv/client';
import { useSpatialNav } from '../../lib/tv/useSpatialNav';

/**
 * Turns on D-pad navigation when `html[data-tv]` is set (M49-S15). Mounted once in the root layout. It stays off on
 * the watch page, where the player owns the remote keys.
 */
export function TvNav() {
  const pathname = usePathname() ?? '';
  const [tv, setTv] = useState(false);
  useEffect(() => {
    const sync = () => setTv(document.documentElement.hasAttribute('data-tv'));
    sync();
    window.addEventListener(TV_EVENT, sync);
    return () => window.removeEventListener(TV_EVENT, sync);
  }, []);
  useSpatialNav({ enabled: tv && !pathname.startsWith('/watch') });
  return null;
}
