import {
  positionCode,
  positionLong,
  resolveSeriesLabels,
  type SeriesLabelSetting,
} from '@ad/shared/series-labels';
import { formatClock } from '@ad/ui';
import type { PlayLabel } from './title-cta';

/** Exact length for the title page: "5 min 52 sec" (S18). */
export function exactDuration(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const rest = total % 60;
  const parts: string[] = [];
  if (hours) parts.push(`${hours} hr`);
  if (minutes) parts.push(`${minutes} min`);
  if (rest || parts.length === 0) parts.push(`${rest} sec`);
  return parts.join(' ');
}

export function exactLeft(durationSeconds: number, positionSeconds: number): string {
  return `${exactDuration(Math.max(0, durationSeconds - positionSeconds))} left`;
}

export function watchedLabel(positionSeconds: number, durationSeconds: number): string {
  return `${formatClock(positionSeconds)} of ${formatClock(durationSeconds)} watched`;
}

export function seriesLine(series: {
  title: string;
  season: number;
  episode: number;
  labels?: SeriesLabelSetting;
}) {
  const words = resolveSeriesLabels(series.labels, null);
  return {
    long: `${series.title}, ${positionLong(words, series.season, series.episode)}`,
    short: `${series.title}, ${positionCode(words, series.season, series.episode)}`,
  };
}

export function titlePrimaryText(
  label: PlayLabel,
  positionSeconds: number,
  durationSeconds: number,
): string {
  if (label === 'watch_again') return 'Watch again';
  if (label === 'resume') return `Resume, ${exactLeft(durationSeconds, positionSeconds)}`;
  return 'Play';
}
