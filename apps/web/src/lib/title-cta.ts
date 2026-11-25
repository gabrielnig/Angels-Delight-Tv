import {
  positionCode,
  resolveSeriesLabels,
  type SeriesLabelSetting,
} from '@ad/shared/series-labels';
import { formatClock } from '@ad/ui';

export type PlayLabel = 'play' | 'resume' | 'watch_again';

export interface PrimaryAction {
  text: string;
  href: string;
  /** Set when resuming, so the viewer can begin again. */
  startOverHref?: string;
}

/** The main button of a title or series page (M07-S01, M07-S02, M07-S03). */
export function primaryAction(input: {
  label: PlayLabel;
  startSeconds: number;
  watchHref: string;
  episode?: { season: number; number: number; labels?: SeriesLabelSetting };
}): PrimaryAction {
  const where = input.episode
    ? ` ${positionCode(resolveSeriesLabels(input.episode.labels, null), input.episode.season, input.episode.number)}`
    : '';
  const fromStart = `${input.watchHref}?t=0`;
  if (input.label === 'watch_again') {
    return { text: `Watch again${where}`, href: fromStart, startOverHref: undefined };
  }
  if (input.label === 'resume') {
    return {
      text: input.episode ? `Resume${where}` : `Resume from ${formatClock(input.startSeconds)}`,
      href: input.watchHref,
      startOverHref: fromStart,
    };
  }
  return { text: `Play${where}`, href: input.watchHref, startOverHref: undefined };
}
