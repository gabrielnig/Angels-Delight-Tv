'use client';

import { useState } from 'react';
import { Button, EmptyState, SeriesCard, VideoCard, useToast } from '@ad/ui';
import { addToListAction, removeFromListAction } from '../../app/actions';
import type { CatalogItem, Page } from '../../lib/data';
import { msg } from '@ad/shared/messages';
import { itemHref, itemKey, metaLine } from '../../lib/format';

export interface MyListGridProps {
  initialItems: CatalogItem[];
  total: number;
  nextCursor: string | null;
  hiddenCount: number;
  /** The active filter, so an empty result can say why and offer a way back (S128). */
  filter?: 'all' | 'started' | 'not_started';
  sort?: 'newest' | 'oldest' | 'az' | 'za';
  loadMore: (cursor: string) => Promise<Page<CatalogItem>>;
  remove?: (itemKey: string) => Promise<void>;
  add?: (itemKey: string) => Promise<void>;
}

/** Screen 19. Saved items, newest first. Removing is immediate with an Undo toast. */
export function MyListGrid({
  initialItems,
  total,
  nextCursor,
  hiddenCount,
  filter = 'all',
  loadMore,
  remove = removeFromListAction,
  add = addToListAction,
}: MyListGridProps) {
  const [items, setItems] = useState(initialItems);
  const [cursor, setCursor] = useState(nextCursor);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const toast = useToast();

  async function onRemove(item: CatalogItem) {
    const key = itemKey(item);
    const index = items.findIndex((i) => itemKey(i) === key);
    setItems((current) => current.filter((i) => itemKey(i) !== key));
    try {
      await remove(key);
      toast.show({
        message: 'Removed from My List.',
        variant: 'success',
        action: {
          label: 'Undo',
          onClick: () => {
            setItems((current) => {
              const next = [...current];
              next.splice(Math.min(index, next.length), 0, item);
              return next;
            });
            void add(key).catch(() => {
              setItems((current) => current.filter((i) => itemKey(i) !== key));
              toast.show({ message: 'We could not update My List. Try again.', variant: 'error' });
            });
          },
        },
      });
    } catch {
      setItems((current) => {
        const next = [...current];
        next.splice(Math.min(index, next.length), 0, item);
        return next;
      });
      toast.show({ message: 'We could not update My List. Try again.', variant: 'error' });
    }
  }

  async function more() {
    if (!cursor || loading) return;
    setLoading(true);
    setFailed(false);
    try {
      const page = await loadMore(cursor);
      setItems((current) => [...current, ...page.items]);
      setCursor(page.nextCursor);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }

  const hidden =
    hiddenCount > 0 ? (
      <p className="web-grid-count">{`${hiddenCount} ${hiddenCount === 1 ? 'item is' : 'items are'} hidden in this profile.`}</p>
    ) : null;

  if (items.length === 0 && !cursor && filter !== 'all') {
    const started = filter === 'started';
    return (
      <EmptyState
        live
        title={
          started
            ? msg('engage.mylist.emptyStartedTitle')
            : msg('engage.mylist.emptyNotStartedTitle')
        }
        description={
          started
            ? msg('engage.mylist.emptyStartedBody')
            : msg('engage.mylist.emptyNotStartedBody')
        }
        action={{ label: msg('engage.mylist.showAll'), href: '/my-list' }}
      />
    );
  }

  if (items.length === 0 && !cursor) {
    return (
      <>
        <EmptyState
          title="Your list is empty"
          description="Tap the plus on any video to save it here."
          action={{ label: 'Browse videos', href: '/browse' }}
        />
        {hidden}
      </>
    );
  }

  return (
    <div className="web-grid-wrap">
      <p className="web-grid-count" aria-live="polite">
        {`${total} saved`}
      </p>
      <ul className="web-grid">
        {items.map((item) => (
          <li key={itemKey(item)}>
            {item.kind === 'series' ? (
              <SeriesCard
                title={item.title}
                href={itemHref(item)}
                thumbnail={item.thumbnail}
                episodeCount={item.episodeCount}
                inList
                onToggleList={() => void onRemove(item)}
              />
            ) : (
              <VideoCard
                title={item.title}
                href={itemHref(item)}
                durationSeconds={item.durationSeconds}
                thumbnail={item.thumbnail}
                meta={metaLine(item)}
                inList
                onToggleList={() => void onRemove(item)}
              />
            )}
          </li>
        ))}
      </ul>
      {hidden}
      {failed ? (
        <p role="alert" className="web-grid-error">
          Could not load more.
        </p>
      ) : null}
      {cursor ? (
        <div className="web-grid-more">
          <Button variant="secondary" loading={loading} onClick={() => void more()}>
            {loading ? 'Loading' : 'Show more'}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
