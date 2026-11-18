'use client';

import { useState } from 'react';
import { ContinueCard, Row, SeriesCard, VideoCard, useToast } from '@ad/ui';
import { restoreContinueAction, removeContinueAction } from '../app/actions';
import { useListToggle } from '../lib/pwa/useListToggle';
import type { CatalogItem, Progress, VideoSummary } from '../lib/data';
import { itemHref, itemKey, metaLine, percent, timeLeftLabel } from '../lib/format';

type ToggleList = (itemKey: string, add: boolean) => Promise<void | 'sent' | 'queued'>;

/** A catalogue card with an optimistic My List toggle that rolls back and says so on failure. */
export function CatalogCard({
  item,
  inList: initialInList,
  priority,
  toggle: toggleProp,
  showMeta = false,
}: {
  item: CatalogItem;
  inList: boolean;
  priority?: boolean;
  toggle?: ToggleList;
  showMeta?: boolean;
}) {
  const [inList, setInList] = useState(initialInList);
  const queued = useListToggle();
  const toggle = toggleProp ?? queued;
  const toast = useToast();
  const key = itemKey(item);

  async function onToggle() {
    const next = !inList;
    setInList(next);
    try {
      const outcome = await toggle(key, next);
      toast.show({
        message:
          outcome === 'queued'
            ? 'Saved on this device. It will sync when you are back online.'
            : next
              ? 'Added to My List.'
              : 'Removed from My List.',
        variant: 'success',
        action: {
          label: 'Undo',
          onClick: () => {
            setInList(!next);
            void toggle(key, !next).catch(() => setInList(next));
          },
        },
      });
    } catch {
      setInList(!next);
      toast.show({ message: 'We could not update My List. Try again.', variant: 'error' });
    }
  }

  if (item.kind === 'series') {
    return (
      <SeriesCard
        title={item.title}
        href={itemHref(item)}
        thumbnail={item.thumbnail}
        episodeCount={item.episodeCount}
        priority={priority}
        inList={inList}
        onToggleList={onToggle}
      />
    );
  }
  return (
    <VideoCard
      title={item.title}
      href={itemHref(item)}
      durationSeconds={item.durationSeconds}
      thumbnail={item.thumbnail}
      meta={showMeta ? metaLine(item) : undefined}
      description={item.description}
      priority={priority}
      inList={inList}
      onToggleList={onToggle}
    />
  );
}

type RowItem = { video: VideoSummary; progress: Progress };

export function ContinueRow({
  items,
  remove = removeContinueAction,
  restore = restoreContinueAction,
}: {
  items: RowItem[];
  remove?: (videoId: string) => Promise<void>;
  restore?: (videoId: string) => Promise<void>;
}) {
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const toast = useToast();

  async function onRemove(video: VideoSummary) {
    setHidden((current) => new Set(current).add(video.id));
    try {
      await remove(video.id);
      toast.show({
        message: 'Removed from Continue watching.',
        variant: 'info',
        action: {
          label: 'Undo',
          onClick: () => {
            setHidden((current) => {
              const next = new Set(current);
              next.delete(video.id);
              return next;
            });
            void restore(video.id);
          },
        },
      });
    } catch {
      setHidden((current) => {
        const next = new Set(current);
        next.delete(video.id);
        return next;
      });
      toast.show({ message: 'We could not remove that. Try again.', variant: 'error' });
    }
  }

  const visible = items.filter(({ video }) => !hidden.has(video.id));

  return (
    <Row title="Continue watching">
      {visible.map(({ video, progress }) => (
        <ContinueCard
          key={video.id}
          title={video.title}
          href={`/watch/${video.id}?t=${Math.floor(progress.positionSeconds)}`}
          durationSeconds={video.durationSeconds}
          thumbnail={video.thumbnail}
          progressPercent={progress.durationSeconds > 0 ? percent(progress) : undefined}
          timeLeftLabel={timeLeftLabel(progress)}
          onRemove={() => void onRemove(video)}
        />
      ))}
    </Row>
  );
}
