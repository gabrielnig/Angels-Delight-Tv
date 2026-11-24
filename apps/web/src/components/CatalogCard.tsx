'use client';

import { useState } from 'react';
import { ContinueCard, Row, SeriesCard, VideoCard, useToast, type CardRating } from '@ad/ui';
import { msg } from '@ad/shared/messages';
import { restoreContinueAction, removeContinueAction } from '../app/actions';
import { useMaturityLabels } from '../lib/maturity-context';
import { useProfileId, useProfileKids } from '../lib/profile-context';
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
  const maturityLabels = useMaturityLabels();
  // G is the norm on this site, so it draws no chip. Any other rank shows its label (S122).
  const maturity =
    item.maturityRank != null && item.maturityRank > 0
      ? maturityLabels[item.maturityRank]
      : undefined;
  const profileId = useProfileId();
  const kids = useProfileKids();
  const [rating, setRating] = useState<CardRating['value']>(item.rating ?? null);
  const rateable = Boolean(profileId) && !kids && item.rating !== undefined && Boolean(item.id);

  async function onRate(next: CardRating['value']) {
    const previous = rating;
    setRating(next);
    try {
      const response = await fetch('/api/ratings', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          profileId,
          target: { kind: item.kind, id: item.id },
          value: next,
        }),
      });
      if (!response.ok) throw new Error(String(response.status));
      toast.show({
        message: next === null ? msg('engage.rating.cleared') : msg('engage.rating.saved'),
        variant: 'success',
      });
    } catch {
      setRating(previous);
      toast.show({ message: msg('engage.rating.error'), variant: 'error' });
    }
  }

  const ratingProps = rateable
    ? {
        rating: {
          value: rating,
          onChange: (value: CardRating['value']) => void onRate(value),
          labels: {
            group: msg('engage.rating.cardGroup'),
            notForMe: msg('engage.rating.notForMe'),
            like: msg('engage.rating.like'),
            love: msg('engage.rating.love'),
            yourRating: msg('engage.rating.yours'),
          },
        },
      }
    : {};

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
        seasonCount={item.seasonCount}
        hasCaptions={item.hasCaptions}
        priority={priority}
        inList={inList}
        onToggleList={onToggle}
        mostLiked={item.mostLiked}
        maturity={maturity}
        {...ratingProps}
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
      hasCaptions={item.hasCaptions}
      inList={inList}
      onToggleList={onToggle}
      mostLiked={item.mostLiked}
      maturity={maturity}
      {...ratingProps}
    />
  );
}

type RowItem = { video: VideoSummary; progress: Progress };

export function ContinueRow({
  items,
  remove = removeContinueAction,
  restore = restoreContinueAction,
  title = 'Continue watching',
}: {
  items: RowItem[];
  remove?: (videoId: string) => Promise<void>;
  restore?: (videoId: string) => Promise<void>;
  /** The row heading. Visitors see Continue learning. */
  title?: string;
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
    <Row title={title}>
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
