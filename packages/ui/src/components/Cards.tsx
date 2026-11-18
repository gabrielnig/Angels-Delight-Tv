'use client';

import { useState, type ReactNode } from 'react';
import { Badge } from './Badge';
import { IconButton } from './Button';
import { cx } from './cx';
import { formatClock, spokenLength } from './format';
import { Icon } from './Icon';
import { Link } from './Link';
import { ProgressBar } from './ProgressBar';

export interface Thumbnail {
  src: string;
  srcSet?: string;
  sizes?: string;
  /** jpeg copy for browsers that cannot read webp. When set, `src` and `srcSet` are the webp set. */
  fallbackSrc?: string;
  fallbackSrcSet?: string;
}

const THUMB_SIZES =
  '(min-width: 1280px) 20vw, (min-width: 960px) 23vw, (min-width: 600px) 30vw, 42vw';

function ThumbImage({
  thumbnail,
  priority,
  onError,
}: {
  thumbnail: Thumbnail;
  priority?: boolean;
  onError: () => void;
}) {
  const sizes = thumbnail.sizes ?? THUMB_SIZES;
  const hasFallback = Boolean(thumbnail.fallbackSrc);
  const img = (
    <img
      src={hasFallback ? thumbnail.fallbackSrc : thumbnail.src}
      srcSet={hasFallback ? thumbnail.fallbackSrcSet : thumbnail.srcSet}
      sizes={sizes}
      alt=""
      width={640}
      height={360}
      loading={priority ? 'eager' : 'lazy'}
      decoding="async"
      fetchPriority={priority ? 'high' : undefined}
      onError={onError}
    />
  );
  return hasFallback ? (
    <picture>
      <source type="image/webp" srcSet={thumbnail.srcSet} sizes={sizes} />
      {img}
    </picture>
  ) : (
    img
  );
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
        <ThumbImage thumbnail={thumbnail} priority={priority} onError={() => setFailed(true)} />
      ) : (
        <span className="ad-card__fallback" aria-hidden="true">
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
  /** Shown in a light overlay after the hover delay on desktop. No video preview (M05-S03). */
  description?: string;
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
  description,
  priority,
  inList,
  onToggleList,
  className,
}: VideoCardProps) {
  return (
    <article className={cx('ad-card', className)}>
      <Link href={href} className="ad-card__link">
        <Thumb thumbnail={thumbnail} title={title} priority={priority}>
          <span className="ad-card__badge" aria-hidden="true">
            <Badge variant="duration">{formatClock(durationSeconds)}</Badge>
          </span>
          {description ? (
            <span className="ad-card__peek" data-testid="card-peek" aria-hidden="true">
              <span className="ad-card__peek-text">{description}</span>
              <span className="ad-card__peek-play">
                <Icon name="play" size={16} filled /> Play
              </span>
            </span>
          ) : null}
        </Thumb>
        <span className="ad-card__title">{title}</span>
        <span className="ad-sr-only">, {spokenLength(durationSeconds)}</span>
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
      <Link href={href} className="ad-card__link">
        <Thumb thumbnail={thumbnail} title={title} priority={priority}>
          <span className="ad-card__play" aria-hidden="true">
            <Icon name="play" size={24} filled />
          </span>
          <span className="ad-card__badge" aria-hidden="true">
            <Badge variant="duration">{formatClock(durationSeconds)}</Badge>
          </span>
          {known ? (
            <span className="ad-card__progress" aria-hidden="true">
              <ProgressBar value={rounded} label="Watched" tone="accent" size="sm" />
            </span>
          ) : null}
        </Thumb>
        <span className="ad-card__title">{title}</span>
        <span className="ad-sr-only">
          , {spokenLength(durationSeconds)}
          {known ? `, ${rounded} percent watched` : ''}
          {timeLeftLabel ? `, ${timeLeftLabel}` : ''}
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
      <Link href={href} className="ad-card__link">
        <span className="ad-card__stack">
          <Thumb thumbnail={thumbnail} title={title} priority={priority}>
            <span className="ad-card__badge" aria-hidden="true">
              <Badge variant="duration">{countText}</Badge>
            </span>
          </Thumb>
        </span>
        <span className="ad-card__title">{title}</span>
        <span className="ad-sr-only">, {countText}</span>
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
