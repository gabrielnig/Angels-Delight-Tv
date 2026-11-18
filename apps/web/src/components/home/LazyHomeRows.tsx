'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Row } from '@ad/ui';
import type { HomeRow, HomeRowsPage } from '../../lib/data';
import { itemKey } from '../../lib/format';
import { useDataSaver } from '../../lib/lowdata/useDataSaver';
import { CatalogCard } from '../CatalogCard';

/**
 * Rows below the first screen load when they come within one viewport (half a viewport under Data saver),
 * with a skeleton row after 300 ms and a retry on failure (M05-S04).
 */
export function LazyHomeRows({
  initialCursor,
  inList,
  profileId,
  load,
}: {
  initialCursor: string;
  inList: string[];
  profileId: string;
  load: (cursor: string) => Promise<HomeRowsPage>;
}) {
  const saver = useDataSaver(profileId);
  const [rows, setRows] = useState<HomeRow[]>([]);
  const [cursor, setCursor] = useState<string | null>(initialCursor);
  const [state, setState] = useState<'idle' | 'loading' | 'error'>('idle');
  const sentinel = useRef<HTMLDivElement>(null);
  const busy = useRef(false);
  const saved = new Set(inList);

  const next = useCallback(async () => {
    if (!cursor || busy.current) return;
    busy.current = true;
    setState('loading');
    try {
      const page = await load(cursor);
      setRows((current) => [...current, ...page.rows]);
      setCursor(page.nextCursor);
      setState('idle');
    } catch {
      setState('error');
    } finally {
      busy.current = false;
    }
  }, [cursor, load]);

  useEffect(() => {
    const node = sentinel.current;
    if (!node || !cursor || state !== 'idle') return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) void next();
      },
      { rootMargin: saver.on ? '50% 0px' : '100% 0px' },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [cursor, state, next, saver.on]);

  return (
    <>
      {rows.map((row) => (
        <Row key={row.id} title={row.title} seeAllHref={row.seeAllHref}>
          {row.items.map((item) => (
            <CatalogCard key={itemKey(item)} item={item} inList={saved.has(itemKey(item))} />
          ))}
        </Row>
      ))}
      {state === 'loading' ? <Row title="More to watch" state="loading" /> : null}
      {state === 'error' ? (
        <Row title="More to watch" state="error" onRetry={() => void next()} />
      ) : null}
      {cursor && state === 'idle' ? <div ref={sentinel} aria-hidden="true" /> : null}
    </>
  );
}
