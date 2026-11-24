'use client';

import { useEffect, useRef, useState, type TouchEvent } from 'react';
import { ButtonLink, IconButton } from './Button';
import { cx } from './cx';
import { Icon } from './Icon';
import { Skeleton, SkeletonRegion } from './Skeleton';
import { HeroPreview } from './HeroPreview';
import { useHeroTimer } from './useHeroTimer';

export interface HeroItem {
  id: string;
  title: string;
  description: string;
  meta?: string;
  image?: { src: string; srcSet?: string; mobileSrc?: string; alt: string };
  playHref: string;
  infoHref: string;
  /** Set when the profile has progress, for example "12 min left". Turns Play into Continue. */
  resumeLabel?: string;
  /** Editor's own Play label. Continue still wins when the profile has progress. */
  playLabel?: string;
  /** Muted clip for this slide. Only played when `previewAllowed` is set on the Hero. */
  previewSrc?: string;
}

/** Seconds between slides, in milliseconds (R12). */
export const HERO_ROTATE_MS = 10000;
/** Full rounds before rotation stops (R12). */
export const HERO_MAX_LOOPS = 2;

export function Hero({
  items,
  label,
  state = 'ready',
  fallbackTitle,
  intervalMs,
  maxLoops = HERO_MAX_LOOPS,
  skeletonDelayMs,
  previewAllowed = false,
  className,
}: {
  items: HeroItem[];
  label: string;
  state?: 'ready' | 'loading' | 'error';
  fallbackTitle?: string;
  /** Rotation interval, normally HERO_ROTATE_MS. Leave undefined for no rotation (Data saver). */
  intervalMs?: number;
  /** Full rounds before rotation stops on the first slide. 0 never stops. */
  maxLoops?: number;
  skeletonDelayMs?: number;
  /** The page has decided a clip may load (fast link, Data saver off, motion allowed). */
  previewAllowed?: boolean;
  className?: string;
}) {
  const [touchX, setTouchX] = useState<number | null>(null);
  const count = items.length;
  const timer = useHeroTimer({
    count,
    intervalMs,
    maxLoops,
    slideHasImage: Boolean(items[0] && items[Math.min(0, count - 1)]?.image),
  });
  const current = items[timer.index];

  // Keep the slide that is leaving for the length of the fade, never under reduced motion.
  const shownRef = useRef<HeroItem | undefined>(current);
  const [leaving, setLeaving] = useState<HeroItem | null>(null);
  useEffect(() => {
    const previous = shownRef.current;
    shownRef.current = current;
    if (!previous || !current || previous.id === current.id || timer.reduced) return;
    setLeaving(previous);
    const fade = setTimeout(() => setLeaving(null), 350);
    return () => clearTimeout(fade);
  }, [current, timer.reduced]);

  if (state === 'loading') {
    return (
      <SkeletonRegion label={`Loading ${label}`} delayMs={skeletonDelayMs}>
        <div className="ad-hero ad-hero--skeleton">
          <Skeleton className="ad-hero__skeleton-box" />
        </div>
      </SkeletonRegion>
    );
  }

  if (state === 'error' || !current) {
    return (
      <section className={cx('ad-hero ad-hero--fallback', className)} aria-label={label}>
        <div className="ad-hero__content">
          <h2 className="ad-hero__title">{fallbackTitle ?? label}</h2>
        </div>
      </section>
    );
  }

  function onTouchStart(event: TouchEvent) {
    setTouchX(event.touches[0]?.clientX ?? null);
  }
  function onTouchEnd(event: TouchEvent) {
    const end = event.changedTouches[0]?.clientX;
    if (touchX !== null && end !== undefined && Math.abs(end - touchX) > 50)
      timer.step(end < touchX ? 1 : -1);
    setTouchX(null);
  }

  const renderSlide = (item: HeroItem, isLeaving: boolean) => {
    const resume = item.resumeLabel;
    const first = item.id === items[0]?.id;
    const img = item.image ? (
      <img
        src={item.image.src}
        srcSet={item.image.srcSet}
        sizes="100vw"
        alt={item.image.alt}
        fetchPriority={first ? 'high' : undefined}
        loading={first ? 'eager' : 'lazy'}
        decoding="async"
        onLoad={isLeaving ? undefined : timer.imageReady}
        onError={isLeaving ? undefined : timer.imageReady}
      />
    ) : null;
    return (
      <div
        key={item.id}
        className={cx('ad-hero__slide', isLeaving && 'ad-hero__slide--leaving')}
        data-fade={!isLeaving && leaving ? 'true' : undefined}
        aria-hidden={isLeaving ? 'true' : undefined}
        role="group"
        aria-roledescription="slide"
        aria-label={`${items.findIndex((entry) => entry.id === item.id) + 1} of ${count}`}
      >
        <div className="ad-hero__media">
          {item.image?.mobileSrc ? (
            <picture>
              <source media="(max-width: 959px)" srcSet={item.image.mobileSrc} />
              {img}
            </picture>
          ) : (
            img
          )}
          {!isLeaving && previewAllowed && item.previewSrc ? (
            <HeroPreview src={item.previewSrc} active paused={timer.paused} />
          ) : null}
          <div className="ad-hero__scrim" aria-hidden="true" />
        </div>
        <div className="ad-hero__content">
          <h2 className="ad-hero__title">{item.title}</h2>
          {item.meta ? <p className="ad-hero__meta">{item.meta}</p> : null}
          <p className="ad-hero__text">{item.description}</p>
          <div className="ad-hero__actions">
            <ButtonLink
              href={item.playHref}
              size="lg"
              icon="play"
              aria-label={resume ? `Continue, ${resume}` : undefined}
            >
              {resume ? (
                <>
                  Continue <span className="ad-hero__left">{resume}</span>
                </>
              ) : (
                (item.playLabel ?? 'Play')
              )}
            </ButtonLink>
            <ButtonLink href={item.infoHref} size="lg" variant="on-dark" icon="info">
              More info
            </ButtonLink>
          </div>
        </div>
      </div>
    );
  };

  return (
    <section
      className={cx('ad-hero', className)}
      style={intervalMs ? ({ '--hero-interval': `${intervalMs}ms` } as React.CSSProperties) : undefined}
      aria-roledescription="carousel"
      aria-label={label}
      aria-live={timer.live}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      onMouseEnter={() => timer.setHovered(true)}
      onMouseLeave={() => timer.setHovered(false)}
      onFocus={() => timer.setFocused(true)}
      onBlur={() => timer.setFocused(false)}
    >
      {leaving ? renderSlide(leaving, true) : null}
      {renderSlide(current, false)}

      {count > 1 ? (
        <div className="ad-hero__controls">
          <div className="ad-hero__dots">
            {items.map((item, position) => (
              <button
                key={item.id}
                type="button"
                className="ad-hero__dot"
                aria-label={`Show slide ${position + 1}: ${item.title}`}
                aria-current={position === timer.index ? 'true' : undefined}
                onClick={() => timer.go(position)}
              >
                <span aria-hidden="true">
                  {position === timer.index && timer.showFill ? (
                    <i
                      key={timer.key}
                      className="ad-hero__fill"
                      data-running={timer.running ? 'true' : 'false'}
                    />
                  ) : null}
                </span>
              </button>
            ))}
          </div>
          <div className="ad-hero__cluster">
            {timer.showPause ? (
              <button
                type="button"
                className="ad-hero__pause"
                aria-label={timer.paused ? 'Resume rotation' : 'Pause rotation'}
                onClick={timer.togglePause}
              >
                <Icon name={timer.paused ? 'play' : 'pause'} size={18} />
                <span className="ad-hero__pause-text">
                  {timer.paused ? 'Resume rotation' : 'Pause'}
                </span>
              </button>
            ) : null}
            <IconButton
              className="ad-hero__step ad-hero__step--prev"
              variant="on-dark"
              icon="chevronLeft"
              label="Previous slide"
              onClick={() => timer.step(-1)}
            />
            <IconButton
              className="ad-hero__step ad-hero__step--next"
              variant="on-dark"
              icon="chevronRight"
              label="Next slide"
              onClick={() => timer.step(1)}
            />
          </div>
        </div>
      ) : null}
    </section>
  );
}
