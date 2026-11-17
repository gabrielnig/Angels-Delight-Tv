import { PlayIcon, PlusIcon, ReplayIcon } from './icons';
import type { UpNextItem } from '../types';

export interface RelatedItem extends UpNextItem {
  href: string;
}

export interface EndScreenData {
  /** Series title when the video is an episode. */
  seriesTitle?: string;
  /** True when this was the last episode of the series. */
  lastInSeries?: boolean;
  related?: RelatedItem[];
  inMyList?: boolean;
  onAddToList?: () => void;
  backHref?: string;
  backLabel?: string;
  homeHref?: string;
  browseHref?: string;
}

interface Props {
  data: EndScreenData;
  next: UpNextItem | null;
  countdown: number | null;
  countdownTotal: number;
  cancelled: boolean;
  autoplayNext: boolean;
  onPlayNext(): void;
  onCancel(): void;
  onReplay(): void;
}

function Related({ items }: { items: RelatedItem[] }) {
  if (items.length === 0) return null;
  return (
    <div className="adp-end__related">
      <p className="adp-end__more">More like this</p>
      <ul className="adp-end__row">
        {items.map((r) => (
          <li key={r.id}>
            <a href={r.href} className="adp-end__thumb" aria-label={r.title}>
              {r.posterUrl ? (
                <img src={r.posterUrl} alt="" loading="lazy" />
              ) : (
                <span aria-hidden="true">{r.title}</span>
              )}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Ring({ value, total }: { value: number; total: number }) {
  const r = 34;
  const c = 2 * Math.PI * r;
  return (
    <div className="adp-ring" aria-hidden="true">
      <svg viewBox="0 0 80 80" width="80" height="80">
        <circle cx="40" cy="40" r={r} className="adp-ring__rail" />
        <circle
          cx="40"
          cy="40"
          r={r}
          className="adp-ring__fill"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - value / Math.max(1, total))}
        />
      </svg>
      <span className="adp-ring__n">{value}</span>
    </div>
  );
}

/** Screen 25: end screen and up next. */
export function EndScreen({
  data,
  next,
  countdown,
  countdownTotal,
  cancelled,
  autoplayNext,
  onPlayNext,
  onCancel,
  onReplay,
}: Props) {
  const related = data.related ?? [];
  const addToList = data.onAddToList ? (
    <button
      type="button"
      className="adp-btn adp-btn--ghost"
      onClick={data.onAddToList}
      aria-pressed={data.inMyList ?? false}
    >
      <PlusIcon size={18} />
      {data.inMyList ? 'In My List' : 'Add to My List'}
    </button>
  ) : null;
  const replay = (
    <button type="button" className="adp-btn adp-btn--ghost" onClick={onReplay}>
      <ReplayIcon size={18} />
      Replay
    </button>
  );

  if (next && countdown !== null) {
    return (
      <section className="adp-end" aria-label="Up next">
        <p className="adp-end__kicker">{`Up next in ${countdown} seconds`}</p>
        <div className="adp-end__next">
          <div className="adp-end__poster">
            {next.posterUrl ? <img src={next.posterUrl} alt="" /> : null}
          </div>
          <div className="adp-end__info">
            <h2 className="adp-end__title">{next.title}</h2>
            {next.meta ? <p className="adp-end__meta">{next.meta}</p> : null}
          </div>
          <Ring value={countdown} total={countdownTotal} />
        </div>
        <div className="adp-end__actions">
          <button type="button" className="adp-btn adp-btn--primary" onClick={onPlayNext} autoFocus>
            <PlayIcon size={16} />
            Play now
          </button>
          <button type="button" className="adp-btn adp-btn--ghost" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </section>
    );
  }

  if (next) {
    return (
      <section className="adp-end" aria-label="Up next">
        {!autoplayNext || cancelled ? (
          <p className="adp-end__kicker">{cancelled ? 'Autoplay cancelled' : 'Autoplay is off'}</p>
        ) : null}
        <h2 className="adp-end__title adp-end__title--lead">{`Next: ${next.title}`}</h2>
        <div className="adp-end__actions">
          <button type="button" className="adp-btn adp-btn--primary" onClick={onPlayNext} autoFocus>
            <PlayIcon size={16} />
            Play next
          </button>
          {replay}
          {cancelled && data.backHref ? (
            <a className="adp-btn adp-btn--ghost" href={data.backHref}>
              {data.backLabel ?? 'Back to series'}
            </a>
          ) : (
            addToList
          )}
        </div>
        <Related items={related} />
      </section>
    );
  }

  if (data.lastInSeries && data.seriesTitle) {
    return (
      <section className="adp-end" aria-label="Finished">
        <h2 className="adp-end__title adp-end__title--lead">{`You finished ${data.seriesTitle}`}</h2>
        <p className="adp-end__meta">Well done. Try another series or watch an episode again.</p>
        <div className="adp-end__actions">
          {data.backHref ? (
            <a className="adp-btn adp-btn--primary" href={data.backHref}>
              {data.backLabel ?? 'Back to the series'}
            </a>
          ) : null}
          {replay}
          {data.browseHref ? (
            <a className="adp-btn adp-btn--ghost" href={data.browseHref}>
              Browse more
            </a>
          ) : null}
        </div>
        <Related items={related} />
      </section>
    );
  }

  return (
    <section className="adp-end" aria-label="Finished">
      <h2 className="adp-end__title adp-end__title--lead">Thanks for watching</h2>
      <div className="adp-end__actions">
        <button type="button" className="adp-btn adp-btn--primary" onClick={onReplay} autoFocus>
          <ReplayIcon size={18} />
          Replay
        </button>
        {addToList}
        {data.homeHref ? (
          <a className="adp-btn adp-btn--ghost" href={data.homeHref}>
            Back to Home
          </a>
        ) : null}
      </div>
      <Related items={related} />
    </section>
  );
}
