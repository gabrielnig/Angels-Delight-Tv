import { formatClock } from '@ad/player/format';
import type { WatchData } from '@/lib/data/playback';

/** Title, category, caption badge and description under the player. */
export function WatchDetails({ data }: { data: WatchData }) {
  const { video } = data;
  const hasCaptions = data.captions.some((c) => c.status === 'approved');
  return (
    <section className="watch__details" aria-labelledby="watch-title">
      <p className="watch__meta">
        <span className="watch__badge">{video.categoryLabel}</span>
        {video.series ? <span>{`${video.series.title}, ${video.series.episodeLabel}`}</span> : null}
        <span>{formatClock(video.durationSeconds)}</span>
        {hasCaptions ? (
          <span className="watch__cc" title="Captions available">
            CC<span className="watch__sr"> Captions available</span>
          </span>
        ) : null}
      </p>
      <h1 id="watch-title" className="watch__title">
        {video.title}
      </h1>
      <p className="watch__description">{video.description}</p>
    </section>
  );
}
