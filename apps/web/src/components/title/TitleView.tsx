import { Badge, ButtonLink, EmptyState, Row, Tabs, formatDuration, spokenLength } from '@ad/ui';
import type { TitleDetail } from '../../lib/data';
import { itemKey, timeLeftLabel } from '../../lib/format';
import { CatalogCard } from '../CatalogCard';
import { TitleActions } from './TitleActions';

/** Screen 18. Viewer title page with Play or Continue, My List, details tabs and a related row. */
export function TitleView({ detail, inList }: { detail: TitleDetail; inList: boolean }) {
  const { video, progress } = detail;
  const resume =
    progress && progress.positionSeconds > 0 && progress.positionSeconds < progress.durationSeconds;
  const related = new Set<string>();
  return (
    <div className="web-page web-title">
      <div className="web-title__media" role="img" aria-label={`${video.title} preview`}>
        {video.thumbnail ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={video.thumbnail.src} srcSet={video.thumbnail.srcSet} alt="" />
        ) : null}
      </div>
      <h1 className="web-title__name">{video.title}</h1>
      <p className="web-title__meta">
        <Badge variant="duration" srText={spokenLength(video.durationSeconds)}>
          {formatDuration(video.durationSeconds)}
        </Badge>{' '}
        <span>{video.categoryName}</span>
        {video.ageLabel ? <Badge variant="neutral">{video.ageLabel}</Badge> : null}
        {video.kidsSafe ? <Badge variant="kids">Kids</Badge> : null}
        {video.hasCaptions ? <Badge variant="neutral">Captions</Badge> : null}
      </p>
      <TitleActions
        watchHref={`/watch/${video.slug}`}
        itemKey={itemKey(video)}
        inList={inList}
        resume={resume && progress ? { timeLeft: timeLeftLabel(progress) } : undefined}
      />
      <p className="web-title__desc">{video.description}</p>
      <Tabs
        label="Title details"
        tabs={[
          { id: 'about', label: 'About', panel: <p>{detail.longDescription}</p> },
          {
            id: 'details',
            label: 'Details',
            panel: (
              <p>{detail.credits ?? `Part of ${video.series?.title ?? video.categoryName}.`}</p>
            ),
          },
        ]}
      />
      {detail.related.length > 0 ? (
        <Row title="More like this">
          {detail.related.map((r) => (
            <CatalogCard key={r.id} item={r} inList={related.has(itemKey(r))} />
          ))}
        </Row>
      ) : null}
    </div>
  );
}

export function TitleBlocked() {
  return (
    <div className="web-page">
      <EmptyState
        icon="shield"
        title="This video is not available in Kids"
        description="Switch to a grown-up profile to watch it."
        action={{ label: 'Back to Home', href: '/' }}
      />
    </div>
  );
}

export function PublicTitle({
  title,
  description,
  minutes,
  category,
}: {
  title: string;
  description: string;
  minutes: string;
  category: string;
}) {
  return (
    <div className="web-page web-title">
      <h1 className="web-title__name">{title}</h1>
      <p className="web-title__meta">
        {minutes} <span>{category}</span>
      </p>
      <p className="web-title__desc">{description}</p>
      <div className="web-title-actions">
        <ButtonLink href="/sign-in">Sign in to watch</ButtonLink>
        <ButtonLink href="/sign-up" variant="secondary">
          Create account
        </ButtonLink>
      </div>
    </div>
  );
}
