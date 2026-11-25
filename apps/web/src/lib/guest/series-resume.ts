import { positionCode, resolveSeriesLabels, type SeriesLabelSetting } from '@ad/shared/series-labels';
import type { PrimaryAction } from '../title-cta';
import { GUEST_RESUME_MIN_SECONDS } from './resume';
import type { GuestProgressEntry } from './progress-store';

export interface GuestSeriesEpisode {
  videoId: string;
  href: string;
  group: number;
  number: number;
  durationSeconds: number;
}

/**
 * The main button of a series page for a guest, from what this device remembers (M51-S06, M40). The first
 * unfinished item is the target: Resume when it was started, else Play. All finished says Watch again from the
 * first. With nothing saved the server button stays.
 */
export function guestSeriesPrimary(
  input: { episodes: GuestSeriesEpisode[]; labels?: SeriesLabelSetting },
  saved: Record<string, GuestProgressEntry>,
  server: PrimaryAction,
): PrimaryAction {
  if (!input.episodes.some((e) => saved[e.videoId])) return server;
  const words = resolveSeriesLabels(input.labels, null);
  const code = (e: GuestSeriesEpisode) => positionCode(words, e.group, e.number);
  const target = input.episodes.find((e) => saved[e.videoId]?.f !== true);
  if (!target) {
    const first = input.episodes[0]!;
    return { text: `Watch again ${code(first)}`, href: `${first.href}?t=0` };
  }
  const entry = saved[target.videoId];
  if (entry && entry.p >= GUEST_RESUME_MIN_SECONDS) {
    return { text: `Resume ${code(target)}`, href: target.href, startOverHref: `${target.href}?t=0` };
  }
  return { text: `Play ${code(target)}`, href: target.href };
}
