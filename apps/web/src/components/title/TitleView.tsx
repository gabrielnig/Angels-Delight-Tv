import { Badge, Breadcrumbs, ButtonLink, ProgressBar } from '@ad/ui';
import type { Thumb, TitleDetail } from '../../lib/data';
import { itemKey, percent } from '../../lib/format';
import { primaryAction } from '../../lib/title-cta';
import './title.css';
import { exactDuration, seriesLine, titlePrimaryText, watchedLabel } from '../../lib/title-format';
import { TitleRating, type RatingTarget } from '../engage/TitleRating';
import { ExpandableText } from './ExpandableText';
import { RelatedRow } from './RelatedRow';
import { TitleActions } from './TitleActions';
import { TitlePoster } from './TitlePoster';

/** Screen 18. Poster with play, details, two rows of actions, one description and a related row. */
export function TitleView({
  detail,
  inList,
  guest,
  rating,
  share,
  kids,
}: {
  detail: TitleDetail;
  inList: boolean;
  /** Set for a visitor without an account (M40): My List opens the Sign in to save dialog. */
  guest?: { signUpOpen: boolean };
  /** The signed in profile that may rate this title (adult profiles only, M44-S01). */
  rating?: RatingTarget;
  share?: { channels: ('whatsapp' | 'facebook' | 'x' | 'email')[]; text: string };
  /** A kids profile or Kids mode: Share is hidden. */
  kids?: boolean;
}) {
  const { video, progress, play } = detail;
  const started = play.label === 'resume' && progress;
  const watchHref = `/watch/${video.id}`;
  const primary = primaryAction({ label: play.label, startSeconds: play.startSeconds, watchHref });
  const primaryText = titlePrimaryText(
    play.label,
    progress?.positionSeconds ?? play.startSeconds,
    progress?.durationSeconds ?? video.durationSeconds,
  );
  const series = video.series ? seriesLine(video.series) : null;
  return (
    <div className="web-page tv">
      <div className="tv-crumbs">
        <Breadcrumbs
          tone="viewer"
          items={[
            { label: 'Browse', href: '/browse' },
            { label: video.categoryName, href: `/browse/${video.categorySlug}` },
            { label: video.title },
          ]}
        />
      </div>
      <div className="tv-layout">
        <TitlePoster
          title={video.title}
          thumbnail={video.thumbnail}
          watchHref={watchHref}
          resuming={Boolean(started)}
          percent={started ? percent(progress) : 0}
        />
        <div className="tv-info">
          {series && video.series ? (
            <a className="tv-series" href={`/series/${video.series.slug}`}>
              <span className="tv-series__long">{series.long}</span>
              <span className="tv-series__short">{series.short}</span>
            </a>
          ) : null}
          <h1 className="tv-title">{video.title}</h1>
          <p className="tv-meta">
            <span>{exactDuration(video.durationSeconds)}</span>
            <span>{video.categoryName}</span>
            {video.ageLabel ? <span>{video.ageLabel}</span> : null}
            {video.hasCaptions ? (
              <span
                className="tv-cc"
                role="img"
                aria-label="Captions available"
                title="Captions available"
              >
                <span aria-hidden="true">CC</span>
              </span>
            ) : null}
          </p>
          <TitleActions
            layout="title"
            primary={{ ...primary, text: primaryText }}
            itemKey={itemKey(video)}
            inList={inList}
            shareTitle={video.title}
            share={share}
            kids={kids}
            guest={
              guest
                ? {
                    signUpOpen: guest.signUpOpen,
                    next: `/title/${video.slug}`,
                    videoId: video.id,
                    durationSeconds: video.durationSeconds,
                  }
                : undefined
            }
          />
          {!kids && !video.series && (guest || rating) ? (
            <TitleRating
              target={guest ? undefined : rating}
              guest={
                guest
                  ? {
                      signUpOpen: guest.signUpOpen,
                      next: `/title/${video.slug}`,
                      itemKey: itemKey(video),
                    }
                  : undefined
              }
            />
          ) : null}
          {started ? (
            <div className="tv-progress">
              <ProgressBar
                value={percent(progress)}
                label={`${video.title} progress`}
                size="sm"
                className="tv-progress__bar"
              />
              <p className="tv-progress__text">
                {watchedLabel(progress.positionSeconds, progress.durationSeconds)}
              </p>
            </div>
          ) : null}
          <ExpandableText className="tv-desc" text={detail.longDescription || video.description} />
          {detail.credits ? <p className="tv-credits">{detail.credits}</p> : null}
        </div>
      </div>
      <RelatedRow items={detail.related} />
      <div className="tv-sticky">
        <ButtonLink href={primary.href} icon="play" size="lg" fullWidth>
          {primaryText}
        </ButtonLink>
      </div>
    </div>
  );
}

export function PublicTitle({
  slug,
  title,
  description,
  minutes,
  category,
  thumbnail,
}: {
  slug: string;
  thumbnail?: Thumb;
  title: string;
  description: string;
  minutes: string;
  category: string;
}) {
  return (
    <div className="web-page web-title">
      <div className="web-title__media">
        {thumbnail ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={thumbnail.src} srcSet={thumbnail.srcSet} alt={title} />
        ) : null}
      </div>
      <h1 className="web-title__name">{title}</h1>
      <p className="web-title__meta">
        {minutes} <span>{category}</span>
      </p>
      <p className="web-title__desc">{description}</p>
      <div className="web-title-actions">
        <ButtonLink href={`/sign-in?next=${encodeURIComponent(`/title/${slug}`)}`}>
          Sign in to watch
        </ButtonLink>
        <ButtonLink href="/sign-up" variant="secondary">
          Create account
        </ButtonLink>
      </div>
    </div>
  );
}

export function PublicSeries({
  slug,
  title,
  description,
  episodes,
  category,
  thumbnail,
}: {
  slug: string;
  thumbnail?: Thumb;
  title: string;
  description: string;
  episodes: number;
  category: string;
}) {
  return (
    <div className="web-page web-title">
      <div className="web-title__layout">
        <div className="web-title__media">
          {thumbnail ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={thumbnail.src} srcSet={thumbnail.srcSet} alt={title} />
          ) : null}
        </div>
        <div className="web-title__info">
          <h1 className="web-title__name">{title}</h1>
          <p className="web-title__meta">
            <Badge variant="neutral">{`${episodes} ${episodes === 1 ? 'episode' : 'episodes'}`}</Badge>{' '}
            <span>{category}</span>
          </p>
          <p className="web-title__desc">{description}</p>
          <div className="web-title-actions">
            <ButtonLink href={`/sign-in?next=${encodeURIComponent(`/series/${slug}`)}`}>
              Sign in to watch
            </ButtonLink>
            <ButtonLink href="/sign-up" variant="secondary">
              Create account
            </ButtonLink>
          </div>
        </div>
      </div>
    </div>
  );
}
