'use client';

import { useCallback, useRef, useState } from 'react';

export interface NoticeItem {
  id: string;
  kind: 'new_episode' | 'new_video';
  title: string;
  body: string;
  href: string;
  itemCount: number;
  createdAt: string;
  read: boolean;
}

interface Page {
  items: NoticeItem[];
  unread: number;
  nextCursor: string | null;
}

export type FeedStatus = 'idle' | 'loading' | 'ready' | 'error';

const post = (body: unknown) =>
  fetch('/api/notices', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
    keepalive: true,
  });

/** Loads one profile's notices through the API and keeps read state in step (M44-S11). */
export function useNoticeFeed(profileId: string, onUnread?: (count: number) => void) {
  const [status, setStatus] = useState<FeedStatus>('idle');
  const [items, setItems] = useState<NoticeItem[]>([]);
  const [unread, setUnread] = useState(0);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const report = useRef(onUnread);
  report.current = onUnread;

  const apply = useCallback((count: number) => {
    setUnread(count);
    report.current?.(count);
  }, []);

  const load = useCallback(
    async (limit: number, cursor?: string) => {
      if (!cursor) setStatus('loading');
      try {
        const query = new URLSearchParams({ profileId, limit: String(limit) });
        if (cursor) query.set('cursor', cursor);
        const response = await fetch(`/api/notices?${query}`);
        if (!response.ok) throw new Error(String(response.status));
        const page = (await response.json()) as Page;
        setItems((current) => (cursor ? [...current, ...page.items] : page.items));
        setNextCursor(page.nextCursor);
        apply(page.unread);
        setStatus('ready');
      } catch {
        setStatus('error');
      }
    },
    [profileId, apply],
  );

  const markAll = useCallback(async () => {
    const before = items;
    setItems((current) => current.map((item) => ({ ...item, read: true })));
    apply(0);
    try {
      const response = await post({ profileId, ids: 'all' });
      if (!response.ok) throw new Error(String(response.status));
    } catch {
      setItems(before);
      apply(before.filter((item) => !item.read).length);
    }
  }, [items, profileId, apply]);

  const markOne = useCallback(
    (id: string) => {
      const target = items.find((item) => item.id === id);
      if (!target || target.read) return;
      setItems((current) => current.map((item) => (item.id === id ? { ...item, read: true } : item)));
      apply(Math.max(0, unread - 1));
      void post({ profileId, ids: [id] }).catch(() => undefined);
    },
    [items, unread, profileId, apply],
  );

  return { status, items, unread, nextCursor, load, markAll, markOne };
}
