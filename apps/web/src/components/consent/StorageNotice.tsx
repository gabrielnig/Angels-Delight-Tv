'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@ad/ui';
import { dismissNotice, noticeVisible, readNotice } from '../../lib/consent/notice';
import './consent.css';

export interface StorageNoticeProps {
  enabled: boolean;
  /** The wording from the Discovery tab. */
  text: string;
  /** Raise it in admin to show the notice again to everyone. */
  version: number;
}

function deviceStore(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/**
 * The storage notice (M45-S11, R26): one informational sentence, a link to the full list and one Got it button. It is
 * not a consent wall, it never takes focus, and it is never drawn on a watch page. It is fixed, so it adds no layout
 * shift, and it publishes its height as `--notice-h` so a toast can lift above it (DESIGN-SYSTEM 11.13).
 */
export function StorageNotice({ enabled, text, version }: StorageNoticeProps) {
  const pathname = usePathname() ?? '/';
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLElement>(null);
  const onWatchPage = pathname === '/watch' || pathname.startsWith('/watch/');

  useEffect(() => {
    if (!enabled) {
      setOpen(false);
      return;
    }
    setOpen(noticeVisible(readNotice(deviceStore()), version, Date.now()));
  }, [enabled, version]);

  const shown = enabled && open && !onWatchPage;

  useEffect(() => {
    const root = document.documentElement;
    const node = box.current;
    if (!shown || !node) {
      root.style.setProperty('--notice-h', '0px');
      return;
    }
    const publish = () => root.style.setProperty('--notice-h', `${Math.ceil(node.getBoundingClientRect().height)}px`);
    publish();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(publish);
    observer?.observe(node);
    return () => {
      observer?.disconnect();
      root.style.setProperty('--notice-h', '0px');
    };
  }, [shown]);

  if (!shown) return null;

  return (
    <section ref={box} className="ad-notice" role="region" aria-label="Storage notice">
      <p className="ad-notice__text">{text}</p>
      <a className="ad-notice__link" href="/privacy#storage">
        How we use storage
      </a>
      <Button
        className="ad-notice__button"
        onClick={() => {
          dismissNotice(deviceStore(), version, Date.now());
          setOpen(false);
        }}
      >
        Got it
      </Button>
    </section>
  );
}
