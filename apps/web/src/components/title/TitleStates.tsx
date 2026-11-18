import './title.css';
import { Button, ButtonLink, Icon, Skeleton, SkeletonRegion, type IconName } from '@ad/ui';
import type { ReactNode } from 'react';

type Tone = 'info' | 'neutral' | 'danger';

function StateCard({
  tone,
  icon,
  title,
  text,
  children,
}: {
  tone: Tone;
  icon: IconName;
  title: string;
  text: string;
  children: ReactNode;
}) {
  return (
    <div className="web-page tv">
      <div className="tv-state">
        <span className="tv-state__icon" data-tone={tone}>
          <Icon name={icon} size={28} />
        </span>
        <h1 className="tv-state__title">{title}</h1>
        <p className="tv-state__text">{text}</p>
        <div className="tv-state__actions">{children}</div>
      </div>
    </div>
  );
}

/** A Kids profile opened a title that is not in the Kids library. */
export function TitleBlocked() {
  return (
    <StateCard
      tone="info"
      icon="shield"
      title="Not available on this profile"
      text="This video is not part of the Kids library. Switch to an adult profile to watch it."
    >
      <ButtonLink href="/">Back to Home</ButtonLink>
      <ButtonLink href="/profiles?switch=1" variant="secondary">
        Switch profile
      </ButtonLink>
    </StateCard>
  );
}

export function TitleNotFound() {
  return (
    <StateCard
      tone="neutral"
      icon="search"
      title="We could not find that video"
      text="The link may be old, or the video may have been removed. Try browsing by subject instead."
    >
      <ButtonLink href="/browse">Browse subjects</ButtonLink>
    </StateCard>
  );
}

export function TitleError({ reference, onRetry }: { reference?: string; onRetry: () => void }) {
  return (
    <StateCard
      tone="danger"
      icon="warning"
      title="We could not load this video"
      text={`Something went wrong on our side. Your place in the video is safe.${reference ? ` Reference ${reference}.` : ''}`}
    >
      <Button onClick={onRetry}>Try again</Button>
      <ButtonLink href="/" variant="secondary">
        Back to Home
      </ButtonLink>
    </StateCard>
  );
}

/** Matches the final geometry of the title page so nothing shifts when the data arrives. Shows after 300ms. */
export function TitleSkeleton({ delayMs }: { delayMs?: number }) {
  return (
    <div className="web-page tv tv--loading">
      <SkeletonRegion delayMs={delayMs}>
        <div className="tv-layout">
          <Skeleton className="tv-sk tv-sk--poster" />
          <div className="tv-info">
            <Skeleton className="tv-sk tv-sk--series" />
            <Skeleton className="tv-sk tv-sk--title" />
            <Skeleton className="tv-sk tv-sk--meta" />
            <div className="tv-sk-row">
              <Skeleton className="tv-sk tv-sk--button" />
              <Skeleton className="tv-sk tv-sk--button-small" />
            </div>
            <Skeleton className="tv-sk tv-sk--line tv-sk--line-first" />
            <Skeleton className="tv-sk tv-sk--line tv-sk--line-96" />
            <Skeleton className="tv-sk tv-sk--line tv-sk--line-70" />
          </div>
        </div>
      </SkeletonRegion>
    </div>
  );
}
