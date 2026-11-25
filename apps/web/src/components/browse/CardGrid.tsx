'use client';

import { useT } from '../../lib/i18n/provider';
import { useState } from 'react';
import { Badge, Button } from '@ad/ui';
import type { CatalogItem, Page } from '../../lib/data';
import { itemKey } from '../../lib/format';
import { CatalogCard } from '../CatalogCard';

export interface CardGridProps {
  initialItems: CatalogItem[];
  total: number;
  nextCursor: string | null;
  inList: string[];
  loadMore: (cursor: string) => Promise<Page<CatalogItem>>;
  /** Plural noun, for example "videos". */
  countLabel: string;
  /** Adds a Video or Series label to each card (search results, M06-S09). */
  showType?: boolean;
  /** The page shows the count itself (Browse puts it beside the title). */
  hideCount?: boolean;
}

function countText(total: number, noun: string) {
  return `${total} ${total === 1 ? noun.replace(/s$/, '') : noun}`;
}

/** A responsive grid of cards with a polite live count and a Show more button that keeps loaded cards on failure. */
export function CardGrid({
  initialItems,
  total,
  nextCursor,
  inList,
  loadMore,
  countLabel,
  showType = false,
  hideCount = false,
}: CardGridProps) {
  const msg = useT();
  const [items, setItems] = useState(initialItems);
  const [cursor, setCursor] = useState(nextCursor);
  const [count, setCount] = useState(total);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const saved = new Set(inList);

  async function more() {
    if (!cursor || loading) return;
    setLoading(true);
    setFailed(false);
    try {
      const page = await loadMore(cursor);
      setItems((current) => [...current, ...page.items]);
      setCursor(page.nextCursor);
      setCount(page.total);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="web-grid-wrap">
      {hideCount ? null : (
        <p className="web-grid-count" aria-live="polite">
          {countText(count, countLabel)}
        </p>
      )}
      <ul className="web-grid">
        {items.map((item) => (
          <li key={itemKey(item)}>
            <CatalogCard item={item} inList={saved.has(itemKey(item))} showMeta />
            {showType ? (
              <Badge variant="neutral">
                {item.kind === 'series' ? msg('browse.series') : msg('browse.video')}
              </Badge>
            ) : null}
          </li>
        ))}
      </ul>
      {failed ? (
        <div className="web-grid-more web-grid-more--failed">
          <p role="alert" className="web-grid-error">
            {msg('browse.couldNotLoadMore', { countLabel })} {msg('browse.stillHere')}
          </p>
          <Button variant="secondary" size="lg" onClick={() => void more()}>
            {msg('browse.tryAgain')}
          </Button>
        </div>
      ) : cursor ? (
        <div className="web-grid-more">
          <Button variant="secondary" size="lg" loading={loading} onClick={() => void more()}>
            {loading ? msg('browse.loadingMore') : msg('browse.showMore')}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
