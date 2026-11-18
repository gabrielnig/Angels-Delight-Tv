'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, useTransition } from 'react';
import { Icon } from './Icon';

export interface BellNotice {
  id: string;
  title: string;
  body: string;
  href: string | null;
  createdAt: string;
  read: boolean;
}

interface Props {
  items: BellNotice[];
  unread: number;
  markAllRead: () => Promise<void>;
}

/** The admin bell (M21-S03): unread badge, the latest notices, and Mark all as read. */
export function NoticeBell({ items, unread, markAllRead }: Props) {
  const [open, setOpen] = useState(false);
  const [cleared, setCleared] = useState(false);
  const [failed, setFailed] = useState(false);
  const [pending, start] = useTransition();
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const count = cleared ? 0 : unread;

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        button.current?.focus();
      }
    };
    const onClick = (event: MouseEvent) => {
      if (root.current && !root.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onClick);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onClick);
    };
  }, [open]);

  const clear = () =>
    start(async () => {
      setFailed(false);
      try {
        await markAllRead();
        setCleared(true);
      } catch {
        setFailed(true);
      }
    });

  return (
    <div className="adm-bell" ref={root}>
      <button
        ref={button}
        type="button"
        className="adm-btn adm-btn--ghost adm-bell__button"
        aria-label={count > 0 ? `Notifications, ${count} unread` : 'Notifications'}
        aria-expanded={open}
        aria-controls="adm-bell-panel"
        onClick={() => setOpen((v) => !v)}
      >
        <Icon name="bell" />
        {count > 0 ? (
          <span className="adm-bell__badge" aria-hidden="true">
            {count > 9 ? '9+' : count}
          </span>
        ) : null}
      </button>
      {open ? (
        <div
          className="adm-bell__panel"
          id="adm-bell-panel"
          role="region"
          aria-label="Notifications"
        >
          <div className="adm-bell__head">
            <strong>Notifications</strong>
            <button
              type="button"
              className="adm-btn adm-btn--ghost"
              disabled={count === 0 || pending}
              onClick={clear}
            >
              Mark all as read
            </button>
          </div>
          {failed ? (
            <p className="adm-bell__empty" role="alert">
              Could not mark them as read. Try again.
            </p>
          ) : null}
          {items.length === 0 ? (
            <p className="adm-bell__empty">Nothing new</p>
          ) : (
            <ul className="adm-bell__list">
              {items.map((item) => {
                const unreadItem = !item.read && !cleared;
                const content = (
                  <>
                    <span className="adm-bell__title">
                      {unreadItem ? <span className="adm-sr">Unread: </span> : null}
                      {item.title}
                    </span>
                    {item.body ? <span className="adm-muted">{item.body}</span> : null}
                  </>
                );
                return (
                  <li key={item.id} className={unreadItem ? 'is-unread' : undefined}>
                    {item.href ? (
                      <Link href={item.href} onClick={() => setOpen(false)}>
                        {content}
                      </Link>
                    ) : (
                      <div>{content}</div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
