'use client';

import { useState, type ReactNode } from 'react';
import { Badge } from './Badge';
import { IconButton } from './Button';
import { cx } from './cx';
import { formatClock, spokenDuration, spokenLength } from './format';
import { Icon } from './Icon';
import { Link } from './Link';
import { ProgressBar } from './ProgressBar';

export interface Thumbnail {
  src: string;
  srcSet?: string;
  sizes?: string;
}

function Thumb({
  thumbnail,
  title,
  priority,
  children,
}: {
  thumbnail?: Thumbnail;
  title: string;
  priority?: boolean;
  children?: ReactNode;
}) {
  const [failed, setFailed] = useState(false);
  const showImage = thumbnail && !failed;
  return (
    <span className="ad-card__thumb">
      {showImage ? (
        <img
          src={thumbnail.src}
          srcSet={thumbnail.srcSet}
          sizes={
            thumbnail.sizes ??
            '(min-width: 1280px) 20vw, (min-width: 960px) 23vw, (min-width: 600px) 30vw, 42vw'
          }
          alt=""
          width={640}
          height={360}
          loading={priority ? 'eager' : 'lazy'}
          decoding="async"
          fetchPriority={priority ? 'high' : undefined}
          onError={() => setFailed(true)}
        />
      ) : (
        <span className="ad-card__fallback">
          <Icon name="play" size={24} filled />
          <span className="ad-card__fallback-title">{title}</span>
        </span>
      )}
      {children}
    </span>
  );
}

export interface VideoCardProps {
  title: string;
  href: string;
  durationSeconds: number;
  thumbnail?: Thumbnail;
  meta?: string;
  priority?: boolean;
  /** When defined the My List button shows. */
  inList?: boolean;
  onToggleList?: () => void;
  className?: string;
}

export function VideoCard({
  title,
  href,
  durationSeconds,
  thumbnail,
  meta,
  priority,
  inList,
  onToggleList,
  className,
}: VideoCardProps) {
  return (
    <article className={cx('ad-card', className)}>
      <Link
        href={href}
        className="ad-card__link"
        aria-label={`${title}, ${spokenLength(durationSeconds)}`}
      >
        <Thumb thumbnail={thumbnail} title={title} priority={priority}>
          <span className="ad-card__badge">
            <Badge variant="duration" srText={spokenDuration(durationSeconds)}>
              {formatClock(durationSeconds)}
            </Badge>
          </span>
        </Thumb>
        <span className="ad-card__title" aria-hidden="true">
          {title}
        </span>
        {meta ? (
          <span className="ad-card__meta" aria-hidden="true">
            {meta}
          </span>
        ) : null}
      </Link>
      {onToggleList ? (
        <IconButton
          className="ad-card__action"
          variant="on-dark"
          icon={inList ? 'check' : 'plus'}
          label={inList ? `Remove ${title} from My List` : `Add ${title} to My List`}
          pressed={Boolean(inList)}
          onClick={onToggleList}
        />
      ) : null}
    </article>
  );
}

export interface ContinueCardProps extends Omit<VideoCardProps, 'inList' | 'onToggleList'> {
  /** 0 to 100. Leave undefined when the position is unknown. */
  progressPercent?: number;
  timeLeftLabel?: string;
  onRemove?: () => void;
}

export function ContinueCard({
  title,
  href,
  durationSeconds,
  thumbnail,
  progressPercent,
  timeLeftLabel,
  onRemove,
  priority,
  className,
}: ContinueCardProps) {
  const known = progressPercent !== undefined;
  const rounded = known ? Math.round(Math.min(100, Math.max(0, progressPercent))) : 0;
  return (
    <article className={cx('ad-card ad-card--continue', className)}>
      <Link
        href={href}
        className="ad-card__link"
        aria-label={`Continue ${title}${timeLeftLabel ? `, ${timeLeftLabel}` : ''}${known ? `, ${rounded} percent watched` : ''}`}
      >
        <Thumb thumbnail={thumbnail} title={title} priority={priority}>
          <span className="ad-card__play" aria-hidden="true">
            <Icon name="play" size={24} filled />
          </span>
          <span className="ad-card__badge">
            <Badge variant="duration" srText={spokenDuration(durationSeconds)}>
              {formatClock(durationSeconds)}
            </Badge>
          </span>
          {known ? (
            <span className="ad-card__progress">
              <ProgressBar value={rounded} label="Watched" tone="accent" size="sm" />
              <span className="ad-sr-only">{rounded} percent watched</span>
            </span>
          ) : null}
        </Thumb>
        <span className="ad-card__title" aria-hidden="true">
          {title}
        </span>
        {timeLeftLabel ? (
          <span className="ad-card__meta" aria-hidden="true">
            {timeLeftLabel}
          </span>
        ) : null}
      </Link>
      {onRemove ? (
        <IconButton
          className="ad-card__action ad-card__action--always"
          variant="on-dark"
          icon="close"
          iconSize={20}
          label={`Remove ${title} from Continue watching`}
          onClick={onRemove}
        />
      ) : null}
    </article>
  );
}

export function SeriesCard({
  title,
  href,
  thumbnail,
  episodeCount,
  priority,
  inList,
  onToggleList,
  className,
}: {
  title: string;
  href: string;
  thumbnail?: Thumbnail;
  episodeCount: number;
  priority?: boolean;
  inList?: boolean;
  onToggleList?: () => void;
  className?: string;
}) {
  const countText = `${episodeCount} episode${episodeCount === 1 ? '' : 's'}`;
  return (
    <article className={cx('ad-card ad-card--series', className)}>
      <Link href={href} className="ad-card__link" aria-label={`${title}, ${countText}`}>
        <span className="ad-card__stack">
          <Thumb thumbnail={thumbnail} title={title} priority={priority}>
            <span className="ad-card__badge">
              <Badge variant="duration">{countText}</Badge>
            </span>
          </Thumb>
        </span>
        <span className="ad-card__title" aria-hidden="true">
          {title}
        </span>
      </Link>
      {onToggleList ? (
        <IconButton
          className="ad-card__action"
          variant="on-dark"
          icon={inList ? 'check' : 'plus'}
          label={inList ? `Remove ${title} from My List` : `Add ${title} to My List`}
          pressed={Boolean(inList)}
          onClick={onToggleList}
        />
      ) : null}
    </article>
  );
}
