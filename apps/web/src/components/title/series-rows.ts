import type { SeriesDetail } from '../../lib/data';
import { percent } from '../../lib/format';
import type { SeasonRows } from './EpisodeList';

export function seasonRows(seasons: SeriesDetail['seasons']): SeasonRows[] {
  return seasons.map((season) => ({
    number: season.number,
    title: season.title ?? null,
    episodes: season.episodes.map((e) => {
      const p = e.progress ? percent(e.progress) : 0;
      return {
        number: e.number,
        title: e.video.title,
        blurb: e.blurb,
        durationSeconds: e.video.durationSeconds,
        href: `/watch/${e.video.id}`,
        watched: e.watched,
        percent: p > 0 && p < 100 ? p : undefined,
        current: e.current,
      };
    }),
  }));
}

/** The season shown first: the one in the URL when it exists, else the one the main button opens. */
export function pickSeason(
  seasons: SeriesDetail['seasons'],
  fromUrl: string | undefined,
  fallback: number,
): number {
  const wanted = Number(fromUrl);
  return seasons.some((s) => s.number === wanted) ? wanted : fallback;
}
