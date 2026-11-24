import type { EpisodeRow, SeasonRows } from '../../components/title/EpisodeList';
import type { GuestProgressEntry } from './progress-store';

const WATCH = /\/watch\/([^/?#]+)/;

/**
 * Shows an episode list the way this device remembers it: finished, partly watched, and Up next on the first
 * episode that is not finished once anything has been watched (M40-S15). With nothing saved the list is unchanged.
 */
export function applyGuestProgress(
  seasons: SeasonRows[],
  saved: Record<string, GuestProgressEntry>,
): SeasonRows[] {
  const known = (episode: EpisodeRow) => saved[WATCH.exec(episode.href)?.[1] ?? ''];
  if (!seasons.some((s) => s.episodes.some((e) => known(e)))) return seasons;
  let currentSet = false;
  return seasons.map((season) => ({
    ...season,
    episodes: season.episodes.map((episode) => {
      const entry = known(episode);
      const watched = entry?.f === true;
      const percent =
        entry && !watched && entry.d > 0
          ? Math.min(99, Math.max(1, Math.round((entry.p / entry.d) * 100)))
          : undefined;
      const current = !watched && !currentSet;
      if (current) currentSet = true;
      return { ...episode, watched, percent, current };
    }),
  }));
}
