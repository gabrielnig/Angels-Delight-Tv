'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Icon } from '@ad/ui';
import { msg } from '@ad/shared/messages';
import { useDataSaver } from '../../lib/lowdata/useDataSaver';
import { NoticePanel } from './NoticePanel';
import { spokenUnread } from './notice-format';
import { useNoticeFeed } from './useNoticeFeed';

const POLL_MS = 5 * 60 * 1000;
const WIDE = '(min-width: 960px)';
const POPOVER_ITEMS = 10;

export interface ViewerBellProps {
  profileId: string;
}

/**
 * The bell of an adult signed in profile (M44-S11). The badge is a number with a spoken label. Desktop opens a
 * popover with the latest 10, a phone goes to /notifications. The count is fetched on route change and every
 * five minutes while the tab is visible, and not at all under Data saver (it is fetched when the bell opens).
 */
export function ViewerBell({ profileId }: ViewerBellProps) {
  const pathname = usePathname();
  const saver = useDataSaver(profileId);
  const saverRef = useRef(saver.on);
  saverRef.current = saver.on;
  const [count, setCount] = useState<number | null>(null);
  const [open, setOpen] = useState(false);
  const [wide, setWide] = useState(false);
  const bell = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const feed = useNoticeFeed(profileId, setCount);

  useEffect(() => {
    const query = window.matchMedia(WIDE);
    setWide(query.matches);
    const onChange = (event: MediaQueryListEvent) => setWide(event.matches);
    query.addEventListener?.('change', onChange);
    return () => query.removeEventListener?.('change', onChange);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch(`/api/notices/count?profileId=${encodeURIComponent(profileId)}`);
      if (!response.ok) return;
      const body = (await response.json()) as { count: number };
      if (typeof body.count === 'number') setCount(body.count);
    } catch {
      // A failed count leaves the bell without a badge, which is quiet and honest.
    }
  }, [profileId]);

  // The saver choice resolves right after the first render, so the first fetch waits one tick.
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!saverRef.current) void refresh();
    }, 0);
    return () => clearTimeout(timer);
  }, [pathname, refresh]);

  useEffect(() => {
    if (saver.on) return;
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') void refresh();
    }, POLL_MS);
    return () => clearInterval(id);
  }, [saver.on, refresh]);

  const close = useCallback((returnFocus: boolean) => {
    setOpen(false);
    if (returnFocus) bell.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return;
    panel.current?.focus();
    const onPointer = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!panel.current?.contains(target) && !bell.current?.contains(target)) close(false);
    };
    // Escape works wherever focus is, including after a button inside the panel disabled itself.
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close(true);
    };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onEscape);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onEscape);
    };
  }, [open, close]);

  function toggle() {
    if (open) return close(true);
    setOpen(true);
    void feed.load(POPOVER_ITEMS);
  }

  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key !== 'Tab' || !panel.current) return;
    const focusable = [
      ...panel.current.querySelectorAll<HTMLElement>('a[href], button:not([disabled])'),
    ];
    if (focusable.length === 0) return;
    const first = focusable[0]!;
    const last = focusable[focusable.length - 1]!;
    const active = document.activeElement;
    if (event.shiftKey && (active === first || active === panel.current)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  }

  const label = spokenUnread(count);
  const badge =
    count !== null && count > 0 ? (
      <span className="ad-bell__badge" aria-hidden="true">
        {count > 9 ? '9+' : count}
      </span>
    ) : null;
  const icon = <Icon name="bell" size={24} />;

  return (
    <div className="ad-bell">
      {wide ? (
        <button
          ref={bell}
          type="button"
          className="ad-iconbtn ad-bell__button"
          data-variant="plain"
          aria-label={label}
          aria-haspopup="dialog"
          aria-expanded={open}
          onClick={toggle}
        >
          {icon}
          {badge}
        </button>
      ) : (
        <a className="ad-iconbtn ad-bell__button" data-variant="plain" aria-label={label} href="/notifications">
          {icon}
          {badge}
        </a>
      )}
      {wide && open ? (
        <div
          ref={panel}
          className="ad-bell__popover"
          role="dialog"
          aria-label={msg('engage.notices.title')}
          tabIndex={-1}
          onKeyDown={onKeyDown}
        >
          <NoticePanel
            status={feed.status}
            items={feed.items}
            unread={feed.unread}
            dataSaver={saver.on}
            onRetry={() => void feed.load(POPOVER_ITEMS)}
            onMarkAll={() => void feed.markAll()}
            onOpen={(item) => feed.markOne(item.id)}
            footer={
              <a className="ad-bell__all" href="/notifications">
                {msg('engage.notices.seeAll')}
              </a>
            }
          />
        </div>
      ) : null}
    </div>
  );
}
