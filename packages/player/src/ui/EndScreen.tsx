import { usePlayerT } from '../t';
import { PlayIcon, PlusIcon, ReplayIcon, ShareIcon } from './icons';
import type { UpNextItem } from '../types';
import { StillWatching } from './StillWatching';

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
  /** Opens the page's Share sheet. Left out on a kids profile. Not shown during the autoplay countdown (L15a). */
  onShare?: () => void;
}

interface Props {
  data: EndScreenData;
  next: UpNextItem | null;
  countdown: number | null;
  countdownTotal: number;
  cancelled: boolean;
  autoplayNext: boolean;
  /** Three autoplays ran with no input, so ask before going on. */
  stillWatching?: boolean;
  onKeepWatching?(): void;
  onStopAutoplay?(): void;
  onPlayNext(): void;
  onCancel(): void;
  onReplay(): void;
}

function Related({ items }: { items: RelatedItem[] }) {
  const msg = usePlayerT();
  if (items.length === 0) return null;
  return (
    <div className="adp-end__related">
      <p className="adp-end__more">{msg('player.end.moreLikeThis')}</p>
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
  stillWatching,
  onKeepWatching,
  onStopAutoplay,
  onPlayNext,
  onCancel,
  onReplay,
}: Props) {
  const msg = usePlayerT();
  const related = data.related ?? [];
  const addToList = data.onAddToList ? (
    <button
      type="button"
      className="adp-btn adp-btn--ghost"
      onClick={data.onAddToList}
      aria-pressed={data.inMyList ?? false}
    >
      <PlusIcon size={18} />
      {data.inMyList ? msg('player.end.inList') : msg('player.end.addToList')}
    </button>
  ) : null;
  const share = data.onShare ? (
    <button type="button" className="adp-btn adp-btn--ghost" onClick={data.onShare}>
      <ShareIcon size={18} />
      {msg('player.end.share')}
    </button>
  ) : null;
  const replay = (
    <button type="button" className="adp-btn adp-btn--ghost" onClick={onReplay}>
      <ReplayIcon size={18} />
      {msg('player.end.replay')}
    </button>
  );

  if (next && stillWatching) {
    return (
      <StillWatching
        title={next.title}
        stopHref={data.backHref}
        onKeep={() => onKeepWatching?.()}
        onStop={() => onStopAutoplay?.()}
      />
    );
  }

  if (next && countdown !== null) {
    return (
      <section className="adp-end" aria-label={msg('player.end.upNext')}>
        <p className="adp-end__kicker">{msg('player.end.upNextIn', { count: countdown })}</p>
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
            {msg('player.end.playNow')}
          </button>
          <button type="button" className="adp-btn adp-btn--ghost" onClick={onCancel}>
            {msg('player.end.cancel')}
          </button>
        </div>
      </section>
    );
  }

  if (next) {
    return (
      <section className="adp-end" aria-label={msg('player.end.upNext')}>
        {!autoplayNext || cancelled ? (
          <p className="adp-end__kicker">
            {cancelled ? msg('player.autoplayCancelled') : msg('player.end.autoplayOff')}
          </p>
        ) : null}
        <h2 className="adp-end__title adp-end__title--lead">
          {msg('player.end.next', { title: next.title })}
        </h2>
        <div className="adp-end__actions">
          <button type="button" className="adp-btn adp-btn--primary" onClick={onPlayNext} autoFocus>
            <PlayIcon size={16} />
            {msg('player.end.playNext')}
          </button>
          {replay}
          {share}
          {cancelled && data.backHref ? (
            <a className="adp-btn adp-btn--ghost" href={data.backHref}>
              {data.backLabel ?? msg('player.end.backToSeries')}
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
      <section className="adp-end" aria-label={msg('player.end.finished')}>
        <h2 className="adp-end__title adp-end__title--lead">
          {msg('player.end.youFinished', { title: data.seriesTitle })}
        </h2>
        <p className="adp-end__meta">{msg('player.end.wellDone')}</p>
        <div className="adp-end__actions">
          {data.backHref ? (
            <a className="adp-btn adp-btn--primary" href={data.backHref}>
              {data.backLabel ?? msg('player.end.backToTheSeries')}
            </a>
          ) : null}
          {replay}
          {share}
          {data.browseHref ? (
            <a className="adp-btn adp-btn--ghost" href={data.browseHref}>
              {msg('player.end.browseMore')}
            </a>
          ) : null}
        </div>
        <Related items={related} />
      </section>
    );
  }

  return (
    <section className="adp-end" aria-label={msg('player.end.finished')}>
      <h2 className="adp-end__title adp-end__title--lead">{msg('player.end.thanks')}</h2>
      <div className="adp-end__actions">
        <button type="button" className="adp-btn adp-btn--primary" onClick={onReplay} autoFocus>
          <ReplayIcon size={18} />
          {msg('player.end.replay')}
        </button>
        {share}
        {addToList}
        {data.homeHref ? (
          <a className="adp-btn adp-btn--ghost" href={data.homeHref}>
            {msg('player.end.backHome')}
          </a>
        ) : null}
      </div>
      <Related items={related} />
    </section>
  );
}
