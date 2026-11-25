'use client';

import { useState, type ReactNode } from 'react';
import { Badge } from './Badge';
import { ContinueMenu, type ContinueMenuLabels } from './ContinueMenu';
import { ButtonLink, IconButton } from './Button';
import { cx } from './cx';
import { formatClock, spokenLength } from './format';
import { HoverCard, useHoverCard } from './HoverCard';
import { Icon, type IconName } from './Icon';
import { Link } from './Link';
import { ProgressBar } from './ProgressBar';
import { safePlaceholderBlur, safePlaceholderColor } from './placeholder-safe';
import { useImageLoaded } from './placeholder';

export interface Thumbnail {
  src: string;
  srcSet?: string;
  sizes?: string;
  /** jpeg copy for browsers that cannot read webp. When set, `src` and `srcSet` are the webp set. */
  fallbackSrc?: string;
  fallbackSrcSet?: string;
  /** Tiny webp data url drawn blurred while the image loads. Wins over the colour when both are set. */
  placeholderBlur?: string;
  /** Hex colour drawn while the image loads when there is no blur. */
  placeholderColor?: string;
}

const THUMB_SIZES =
  '(min-width: 1280px) 20vw, (min-width: 960px) 23vw, (min-width: 600px) 30vw, 42vw';

function ThumbImage({
  thumbnail,
  priority,
  onError,
  fade,
}: {
  thumbnail: Thumbnail;
  priority?: boolean;
  onError: () => void;
  /** Present when a placeholder is drawn: the image then starts hidden and fades in on load. */
  fade?: ReturnType<typeof useImageLoaded>;
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
      ref={fade?.ref}
      onLoad={fade?.onLoad}
      data-loaded={fade ? String(fade.loaded) : undefined}
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
  const blur = safePlaceholderBlur(thumbnail?.placeholderBlur);
  const color = safePlaceholderColor(thumbnail?.placeholderColor);
  const fade = useImageLoaded();
  const hasPlaceholder = Boolean(blur || color);
  return (
    <span
      className="ad-card__thumb"
      style={showImage && color ? { backgroundColor: color } : undefined}
    >
      {showImage && blur ? (
        <span
          className="ad-card__blur"
          aria-hidden="true"
          style={{ backgroundImage: `url("${blur}")` }}
        />
      ) : null}
      {showImage ? (
        <ThumbImage
          thumbnail={thumbnail}
          priority={priority}
          onError={() => setFailed(true)}
          fade={hasPlaceholder ? fade : undefined}
        />
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

export type CardRatingValue = -1 | 1 | 2;

export interface CardRating {
  /** This profile's rating of the title, or null when never rated. */
  value: CardRatingValue | null;
  /** Sets a level, or null to clear it. The caller keeps the optimistic state. */
  onChange: (value: CardRatingValue | null) => void;
  /** Spoken and tooltip text. Defaults are English, pass the catalog text for other languages. */
  labels?: { group: string; notForMe: string; like: string; love: string; yourRating?: string };
}

const DEFAULT_RATING_LABELS = {
  group: 'Rate',
  notForMe: 'Not for me',
  like: 'I like this',
  love: 'Love this',
  yourRating: 'Your rating',
};

const RATING_LEVELS: ReadonlyArray<{
  value: CardRatingValue;
  icon: IconName;
  key: 'notForMe' | 'like' | 'love';
}> = [
  { value: -1, icon: 'thumbDown', key: 'notForMe' },
  { value: 1, icon: 'thumbUp', key: 'like' },
  { value: 2, icon: 'heart', key: 'love' },
];

/**
 * The rating chip of the card actions (M44-S03). One button at rest (the current level, or Like), all three on
 * hover or focus. The chip is first in the DOM so Tab meets it first, and `order` keeps the visual order. Shown
 * for a fine pointer only, touch rates on the title page.
 */
function CardRatingChip({ title, rating }: { title: string; rating: CardRating }) {
  const labels = { ...DEFAULT_RATING_LABELS, ...rating.labels };
  const chipValue = rating.value ?? 1;
  const levels = [
    ...RATING_LEVELS.filter((level) => level.value === chipValue),
    ...RATING_LEVELS.filter((level) => level.value !== chipValue),
  ];
  return (
    <div
      role="group"
      aria-label={`${labels.group} ${title}`}
      className="ad-card__rate ad-card__action"
    >
      {levels.map((level) => {
        const pressed = rating.value === level.value;
        const chip = level.value === chipValue;
        return (
          <IconButton
            key={level.value}
            className={cx('ad-card__rate-btn', chip ? undefined : 'ad-card__rate-extra')}
            variant="on-dark"
            icon={level.icon}
            iconSize={20}
            label={labels[level.key]}
            pressed={pressed}
            data-chip={chip ? 'true' : undefined}
            style={{ order: RATING_LEVELS.findIndex((item) => item.value === level.value) }}
            onClick={() => rating.onChange(pressed ? null : level.value)}
          />
        );
      })}
    </div>
  );
}

/** The Most liked mark, a thumb and text. Never a count (M44-S05). */
export function MostLikedLabel({
  label = 'Most liked',
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <span className={cx('ad-most-liked', className)}>
      <Icon name="thumbUp" size={14} filled />
      {label}
    </span>
  );
}

function spokenRating(rating: CardRating | undefined): string {
  if (!rating || rating.value === null) return '';
  const labels = { ...DEFAULT_RATING_LABELS, ...rating.labels };
  const level = RATING_LEVELS.find((item) => item.value === rating.value);
  return level ? `, ${labels.yourRating}: ${labels[level.key]}` : '';
}

function CardActions({
  title,
  inList,
  onToggleList,
  rating,
}: {
  title: string;
  inList?: boolean;
  onToggleList?: () => void;
  rating?: CardRating;
}) {
  if (!onToggleList && !rating) return null;
  return (
    <div className="ad-card__actions">
      {rating ? <CardRatingChip title={title} rating={rating} /> : null}
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
    </div>
  );
}

export interface VideoCardProps {
  title: string;
  href: string;
  durationSeconds: number;
  thumbnail?: Thumbnail;
  meta?: string;
  /** Shown in the hover card on mouse devices. No video preview (M05-S03). */
  description?: string;
  /** Where Play goes from the hover card. Defaults to `href`. */
  playHref?: string;
  /** Subject (category) name shown in the hover card. */
  subject?: string;
  priority?: boolean;
  /** Shows the CC mark and says so in the link name (M11-S05). */
  hasCaptions?: boolean;
  /** When defined the My List button shows. */
  inList?: boolean;
  onToggleList?: () => void;
  /** Rating chip in the actions cluster, for profiles that can rate (M44-S03). */
  rating?: CardRating;
  /** The computed Most liked label, shown in the peek and spoken (M44-S05). */
  mostLiked?: boolean;
  /** The maturity label to show in the peek, for example 12. Leave out for G and for unrated titles (M44-S13). */
  maturity?: string;
  /** Position in a Top 10 row. Spoken first, as Number 3, (M44-S09). */
  rank?: number;
  /** When defined a Share button shows in the hover card. The page owns the sheet, so it can outlive the card. */
  onShare?: () => void;
  className?: string;
}

export function VideoCard({
  title,
  href,
  durationSeconds,
  thumbnail,
  meta,
  description,
  playHref,
  subject,
  priority,
  hasCaptions,
  inList,
  onToggleList,
  rating,
  mostLiked,
  maturity,
  rank,
  onShare,
  className,
}: VideoCardProps) {
  const hover = useHoverCard();
  return (
    <article
      className={cx('ad-card', className)}
      ref={(el) => {
        hover.anchorRef.current = el;
      }}
      {...hover.anchorProps}
    >
      <Link href={href} className="ad-card__link">
        <RankSpoken rank={rank} />
        <Thumb thumbnail={thumbnail} title={title} priority={priority}>
          <span className="ad-card__badge" aria-hidden="true">
            <Badge variant="duration">{formatClock(durationSeconds)}</Badge>
          </span>
          {hasCaptions ? <CaptionMark /> : null}
        </Thumb>
        <span className="ad-card__title">{title}</span>
        <span className="ad-sr-only">
          , {spokenLength(durationSeconds)}
          {hasCaptions ? ', captions available' : ''}
          {maturity ? `, Rated ${maturity}` : ''}
          {mostLiked ? ', Most liked' : ''}
          {spokenRating(rating)}
        </span>
        {meta ? (
          <span className="ad-card__meta" aria-hidden="true">
            {meta}
          </span>
        ) : null}
      </Link>
      <CardActions title={title} inList={inList} onToggleList={onToggleList} rating={rating} />
      {hover.open ? (
        <HoverCard {...hover.cardProps} label={`${title}, details`}>
          <div className="ad-hovercard__thumb">
            {thumbnail ? (
              <img
                src={thumbnail.fallbackSrc ?? thumbnail.src}
                srcSet={thumbnail.fallbackSrcSet ?? thumbnail.srcSet}
                sizes={thumbnail.sizes ?? THUMB_SIZES}
                alt=""
              />
            ) : (
              <span className="ad-card__fallback" aria-hidden="true">
                <Icon name="play" size={24} filled />
              </span>
            )}
          </div>
          <div className="ad-hovercard__body">
            <div className="ad-hovercard__actions">
              <ButtonLink href={playHref ?? href} size="sm" icon="play">
                Play
              </ButtonLink>
              {onToggleList ? (
                <IconButton
                  variant="on-dark"
                  icon={inList ? 'check' : 'plus'}
                  label={inList ? `Remove ${title} from My List` : `Add ${title} to My List`}
                  pressed={Boolean(inList)}
                  onClick={onToggleList}
                />
              ) : null}
              {rating ? <CardRatingChip title={title} rating={rating} /> : null}
              {onShare ? (
                <IconButton
                  variant="on-dark"
                  icon="share"
                  label={`Share ${title}`}
                  onClick={onShare}
                />
              ) : null}
              <Link href={href} className="ad-hovercard__info">
                <Icon name="info" size={16} /> More info
                <span className="ad-sr-only">: {title}</span>
              </Link>
            </div>
            <p className="ad-hovercard__title">{title}</p>
            <p className="ad-hovercard__facts">
              {maturity ? (
                <span className="ad-card__rated" data-testid="card-rated">
                  {maturity}
                </span>
              ) : null}
              <span className="ad-hovercard__length">{formatClock(durationSeconds)}</span>
              {subject ? <span className="ad-hovercard__subject">{subject}</span> : null}
              {mostLiked ? <MostLikedLabel /> : null}
            </p>
            {description ? <p className="ad-hovercard__text">{description}</p> : null}
          </div>
        </HoverCard>
      ) : null}
    </article>
  );
}

export interface ContinueCardProps extends Omit<VideoCardProps, 'inList' | 'onToggleList'> {
  /** 0 to 100. Leave undefined when the position is unknown. */
  progressPercent?: number;
  timeLeftLabel?: string;
  /** "Next: E4" for a next-up episode. Replaces the progress bar. */
  nextLabel?: string;
  onRemove?: () => void;
  /** With `titleHref` and `menuLabels` the remove button becomes a menu (M44-S15). */
  titleHref?: string;
  menuLabels?: ContinueMenuLabels;
  /** Adds Share to the menu when `menuLabels.share` is set. */
  onShare?: () => void;
}

export function ContinueCard({
  title,
  href,
  durationSeconds,
  thumbnail,
  progressPercent,
  timeLeftLabel,
  nextLabel,
  onRemove,
  titleHref,
  menuLabels,
  onShare,
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
          {nextLabel ? (
            <span className="ad-card__next" aria-hidden="true">
              <Badge variant="accent">{nextLabel}</Badge>
            </span>
          ) : null}
          {known ? (
            <span className="ad-card__progress" aria-hidden="true">
              <ProgressBar value={rounded} label="Watched" tone="accent" size="sm" />
            </span>
          ) : null}
        </Thumb>
        <span className="ad-card__title">{title}</span>
        <span className="ad-sr-only">
          , {spokenLength(durationSeconds)}
          {nextLabel ? `, ${nextLabel}` : ''}
          {known ? `, ${rounded} percent watched` : ''}
          {timeLeftLabel ? `, ${timeLeftLabel}` : ''}
        </span>
        {timeLeftLabel ? (
          <span className="ad-card__meta" aria-hidden="true">
            {timeLeftLabel}
          </span>
        ) : null}
      </Link>
      {onRemove && titleHref && menuLabels ? (
        <ContinueMenu
          title={title}
          titleHref={titleHref}
          labels={menuLabels}
          onRemove={onRemove}
          onShare={onShare}
        />
      ) : onRemove ? (
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
  itemsText,
  groupsText,
  hasCaptions,
  priority,
  inList,
  onToggleList,
  rating,
  mostLiked,
  maturity,
  rank,
  className,
}: {
  title: string;
  href: string;
  thumbnail?: Thumbnail;
  /** The item count as words, such as "8 episodes" or "12 chapters". The owner chooses the words (M51). */
  itemsText: string;
  /** Shown instead of the item count on the badge when there is more than one group, such as "3 seasons". */
  groupsText?: string;
  hasCaptions?: boolean;
  priority?: boolean;
  inList?: boolean;
  onToggleList?: () => void;
  rating?: CardRating;
  mostLiked?: boolean;
  /** Spoken as Rated 12. A series card has no peek, so the label is not drawn on it. */
  maturity?: string;
  rank?: number;
  className?: string;
}) {
  const countText = groupsText ? `${groupsText}, ${itemsText}` : itemsText;
  return (
    <article className={cx('ad-card ad-card--series', className)}>
      <Link href={href} className="ad-card__link">
        <RankSpoken rank={rank} />
        <span className="ad-card__stack">
          <Thumb thumbnail={thumbnail} title={title} priority={priority}>
            <span className="ad-card__badge" aria-hidden="true">
              <Badge variant="duration">{groupsText ?? itemsText}</Badge>
            </span>
            {hasCaptions ? <CaptionMark /> : null}
          </Thumb>
        </span>
        <span className="ad-card__title">{title}</span>
        <span className="ad-sr-only">
          , {countText}
          {hasCaptions ? ', captions available' : ''}
          {maturity ? `, Rated ${maturity}` : ''}
          {mostLiked ? ', Most liked' : ''}
          {spokenRating(rating)}
        </span>
      </Link>
      <CardActions title={title} inList={inList} onToggleList={onToggleList} rating={rating} />
    </article>
  );
}

function RankSpoken({ rank }: { rank?: number }) {
  return rank === undefined ? null : <span className="ad-sr-only">{`Number ${rank}, `}</span>;
}

function CaptionMark() {
  return (
    <span className="ad-card__cc" aria-hidden="true">
      CC
    </span>
  );
}
