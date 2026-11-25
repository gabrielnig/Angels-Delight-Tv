'use client';

import { useT } from '../lib/i18n/provider';
import { useState } from 'react';
import { ContinueCard, Row, SeriesCard, VideoCard, useToast, type CardRating } from '@ad/ui';
import { msg } from '@ad/shared/messages';
import { itemCode, resolveSeriesLabels } from '@ad/shared/series-labels';
import { restoreContinueAction, removeContinueAction } from '../app/actions';
import { useMaturityLabels } from '../lib/maturity-context';
import { useProfileId, useProfileKids } from '../lib/profile-context';
import { useListToggle } from '../lib/pwa/useListToggle';
import { useShareTarget } from './share/useShareTarget';
import type { CatalogItem, Progress, VideoSummary } from '../lib/data';
import { itemHref, itemKey, metaLine, percent, seriesCounts, timeLeftLabel } from '../lib/format';

type ToggleList = (itemKey: string, add: boolean) => Promise<void | 'sent' | 'queued'>;

/** A catalogue card with an optimistic My List toggle that rolls back and says so on failure. */
export function CatalogCard({
  item,
  inList: initialInList,
  priority,
  toggle: toggleProp,
  showMeta = false,
  rank,
}: {
  item: CatalogItem;
  inList: boolean;
  priority?: boolean;
  toggle?: ToggleList;
  showMeta?: boolean;
  /** Position in a Top 10 row (M44-S09). */
  rank?: number;
}) {
  const msg = useT();
  const [inList, setInList] = useState(initialInList);
  const queued = useListToggle();
  const toggle = toggleProp ?? queued;
  const toast = useToast();
  const key = itemKey(item);
  const maturityLabels = useMaturityLabels();
  // G is the norm on this site, so it draws no chip. Any other rank shows its label (S122).
  const maturity =
    typeof item.maturityRank === 'number' && item.maturityRank > 0
      ? maturityLabels[item.maturityRank]
      : undefined;
  const profileId = useProfileId();
  const kids = useProfileKids();
  const [rating, setRating] = useState<CardRating['value']>(item.rating ?? null);
  const shareTarget = useShareTarget({
    kind: item.kind === 'series' ? 'series' : 'video',
    slug: item.slug,
    ...(item.id ? { id: item.id } : {}),
    title: item.title,
    thumbnail: item.thumbnail?.src,
  });
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
            ? msg('cards.savedOnThisDevice')
            : next
              ? msg('cards.addedToMyList')
              : msg('cards.removedFromMyList'),
        variant: 'success',
        action: {
          label: msg('cards.undo'),
          onClick: () => {
            setInList(!next);
            void toggle(key, !next).catch(() => setInList(next));
          },
        },
      });
    } catch {
      setInList(!next);
      toast.show({ message: msg('cards.updateFailed'), variant: 'error' });
    }
  }

  if (item.kind === 'series') {
    return (
      <SeriesCard
        title={item.title}
        href={itemHref(item)}
        thumbnail={item.thumbnail}
        {...seriesCounts(item)}
        hasCaptions={item.hasCaptions}
        priority={priority}
        inList={inList}
        onToggleList={onToggle}
        mostLiked={item.mostLiked}
        maturity={maturity}
        rank={rank}
        {...ratingProps}
      />
    );
  }
  return (
    <>
      <VideoCard
        title={item.title}
        href={itemHref(item)}
        durationSeconds={item.durationSeconds}
        thumbnail={item.thumbnail}
        meta={showMeta ? metaLine(item) : undefined}
        description={item.description}
        subject={item.categoryName}
        playHref={`/watch/${item.id}`}
        priority={priority}
        hasCaptions={item.hasCaptions}
        inList={inList}
        onToggleList={onToggle}
        mostLiked={item.mostLiked}
        maturity={maturity}
        rank={rank}
        onShare={shareTarget.onShare}
        {...ratingProps}
      />
      {shareTarget.sheet}
    </>
  );
}

/** "E4" from the item number and the series words, or the tail of the server label. */
function nextEpisodeLabel(video: VideoSummary, progress: Progress): string {
  if (video.series)
    return itemCode(resolveSeriesLabels(video.series.labels, null, msg), video.series.episode);
  return progress.episodeLabel?.split(' ').pop() ?? '';
}

type RowItem = { video: VideoSummary; progress: Progress };

function ContinueRowCard({
  video,
  progress,
  onRemove,
}: {
  video: VideoSummary;
  progress: Progress;
  onRemove: (video: VideoSummary) => Promise<void>;
}) {
  const shareTarget = useShareTarget({
    kind: 'video',
    slug: video.slug,
    id: video.id,
    title: video.title,
    thumbnail: video.thumbnail?.src,
  });
  return (
    <>
      <ContinueCard
        title={video.title}
        href={`/watch/${video.id}?t=${Math.floor(progress.positionSeconds)}`}
        durationSeconds={video.durationSeconds}
        thumbnail={video.thumbnail}
        progressPercent={progress.durationSeconds > 0 ? percent(progress) : undefined}
        timeLeftLabel={
          progress.nextUp ? msg('engage.continue.startsAtBeginning') : timeLeftLabel(progress)
        }
        nextLabel={
          progress.nextUp
            ? msg('engage.continue.next', { code: nextEpisodeLabel(video, progress) })
            : undefined
        }
        titleHref={video.series ? `/series/${video.series.slug}` : `/title/${video.slug}`}
        menuLabels={{
          more: msg('engage.continue.more', { title: '{title}' }),
          remove: msg('engage.continue.remove'),
          goToTitle: msg('engage.continue.goToTitle'),
          share: msg('share.button'),
        }}
        onRemove={() => void onRemove(video)}
        onShare={shareTarget.onShare}
      />
      {shareTarget.sheet}
    </>
  );
}

export function ContinueRow({
  items,
  remove = removeContinueAction,
  restore = restoreContinueAction,
  title = msg('guest.continue.title'),
}: {
  items: RowItem[];
  remove?: (videoId: string) => Promise<void>;
  restore?: (videoId: string) => Promise<void>;
  /** The row heading from the curated descriptor. Defaults to Continue learning (R14). */
  title?: string;
}) {
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const toast = useToast();

  async function onRemove(video: VideoSummary) {
    setHidden((current) => new Set(current).add(video.id));
    try {
      await remove(video.id);
      toast.show({
        message: msg('engage.continue.removed', { row: title }),
        variant: 'info',
        action: {
          label: msg('engage.continue.undo'),
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
      toast.show({ message: msg('cards.removeFailed'), variant: 'error' });
    }
  }

  const visible = items.filter(({ video }) => !hidden.has(video.id));

  return (
    <Row title={title}>
      {visible.map(({ video, progress }) => (
        <ContinueRowCard key={video.id} video={video} progress={progress} onRemove={onRemove} />
      ))}
    </Row>
  );
}
