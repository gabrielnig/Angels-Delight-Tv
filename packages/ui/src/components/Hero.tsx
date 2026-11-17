'use client';

import { useEffect, useState, type TouchEvent } from 'react';
import { ButtonLink, IconButton } from './Button';
import { cx } from './cx';
import { Skeleton, SkeletonRegion } from './Skeleton';

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
}

export function Hero({
  items,
  label,
  state = 'ready',
  fallbackTitle,
  autoRotateMs,
  skeletonDelayMs,
  className,
}: {
  items: HeroItem[];
  label: string;
  state?: 'ready' | 'loading' | 'error';
  fallbackTitle?: string;
  /** Off by default. Interval for opt in rotation. */
  autoRotateMs?: number;
  skeletonDelayMs?: number;
  className?: string;
}) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [hold, setHold] = useState(false);
  const [touchX, setTouchX] = useState<number | null>(null);
  const count = items.length;
  const current = items[Math.min(index, Math.max(0, count - 1))];

  useEffect(() => {
    if (!autoRotateMs || paused || hold || count < 2) return;
    if (
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    )
      return;
    const timer = setInterval(() => setIndex((value) => (value + 1) % count), autoRotateMs);
    return () => clearInterval(timer);
  }, [autoRotateMs, paused, hold, count]);

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

  const step = (delta: number) => setIndex((value) => (value + delta + count) % count);

  function onTouchStart(event: TouchEvent) {
    setTouchX(event.touches[0]?.clientX ?? null);
  }
  function onTouchEnd(event: TouchEvent) {
    const end = event.changedTouches[0]?.clientX;
    if (touchX !== null && end !== undefined && Math.abs(end - touchX) > 50)
      step(end < touchX ? 1 : -1);
    setTouchX(null);
  }

  const resume = current.resumeLabel;

  return (
    <section
      className={cx('ad-hero', className)}
      aria-roledescription="carousel"
      aria-label={label}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      onMouseEnter={() => setHold(true)}
      onMouseLeave={() => setHold(false)}
      onFocus={() => setHold(true)}
      onBlur={() => setHold(false)}
    >
      <div
        key={current.id}
        className="ad-hero__slide"
        role="group"
        aria-roledescription="slide"
        aria-label={`${Math.min(index, count - 1) + 1} of ${count}`}
      >
        <div className="ad-hero__media">
          {current.image ? (
            <img
              src={current.image.src}
              srcSet={current.image.srcSet}
              sizes="100vw"
              alt={current.image.alt}
              fetchPriority={index === 0 ? 'high' : undefined}
              loading={index === 0 ? 'eager' : 'lazy'}
              decoding="async"
            />
          ) : null}
          <div className="ad-hero__scrim" aria-hidden="true" />
        </div>
        <div className="ad-hero__content">
          <h2 className="ad-hero__title">{current.title}</h2>
          {current.meta ? <p className="ad-hero__meta">{current.meta}</p> : null}
          <p className="ad-hero__text">{current.description}</p>
          <div className="ad-hero__actions">
            <ButtonLink
              href={current.playHref}
              size="lg"
              icon="play"
              aria-label={resume ? `Continue, ${resume}` : undefined}
            >
              {resume ? (
                <>
                  Continue <span className="ad-hero__left">{resume}</span>
                </>
              ) : (
                'Play'
              )}
            </ButtonLink>
            <ButtonLink href={current.infoHref} size="lg" variant="on-dark" icon="info">
              More info
            </ButtonLink>
          </div>
        </div>
      </div>

      {count > 1 ? (
        <div className="ad-hero__controls">
          <IconButton
            className="ad-hero__step ad-hero__step--prev"
            variant="on-dark"
            icon="chevronLeft"
            label="Previous slide"
            onClick={() => step(-1)}
          />
          <div className="ad-hero__dots">
            {items.map((item, position) => (
              <button
                key={item.id}
                type="button"
                className="ad-hero__dot"
                aria-label={`Show slide ${position + 1}: ${item.title}`}
                aria-current={position === Math.min(index, count - 1) ? 'true' : undefined}
                onClick={() => setIndex(position)}
              >
                <span aria-hidden="true" />
              </button>
            ))}
          </div>
          {autoRotateMs ? (
            <IconButton
              variant="on-dark"
              icon={paused ? 'play' : 'pause'}
              label={paused ? 'Resume rotation' : 'Pause rotation'}
              onClick={() => setPaused((value) => !value)}
            />
          ) : null}
          <IconButton
            className="ad-hero__step ad-hero__step--next"
            variant="on-dark"
            icon="chevronRight"
            label="Next slide"
            onClick={() => step(1)}
          />
        </div>
      ) : null}
    </section>
  );
}
