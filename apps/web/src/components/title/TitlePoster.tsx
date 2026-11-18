import { Icon } from '@ad/ui';
import type { Thumb } from '../../lib/data';

/** Poster with a centred play button and, once started, a progress strip along the bottom edge (S18). */
export function TitlePoster({
  title,
  thumbnail,
  watchHref,
  resuming,
  percent,
}: {
  title: string;
  thumbnail?: Thumb;
  watchHref: string;
  resuming: boolean;
  /** Whole percent watched. The strip shows only when this is above zero. */
  percent: number;
}) {
  const clamped = Math.min(100, Math.max(0, percent));
  return (
    <div className="tv-poster">
      <div className="tv-poster__art" data-empty={thumbnail ? undefined : 'true'}>
        {thumbnail ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={thumbnail.src} srcSet={thumbnail.srcSet} alt={title} />
        ) : null}
      </div>
      <div className="tv-poster__play">
        <a
          href={watchHref}
          className="tv-poster__button"
          aria-label={`${resuming ? 'Resume' : 'Play'} ${title}`}
        >
          <Icon name="play" size={36} filled />
        </a>
      </div>
      {clamped > 0 ? (
        <div className="tv-poster__strip" aria-hidden="true">
          <span style={{ width: `${clamped}%` }} />
        </div>
      ) : null}
    </div>
  );
}
