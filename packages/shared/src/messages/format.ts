import { msg, type Translate } from './messages';

export { formatDate, formatNumber, pluralCategory, type PluralCategory } from './intl';

/** 6 becomes "6 min", 60 becomes "1 hr", 220 becomes "3 hr 40 min". Words come from the catalog. */
export function formatDuration(minutes: number, t: Translate = msg): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return t('format.duration.min', { count: rest });
  if (rest === 0) return t('format.duration.hr', { count: hours });
  return t('format.duration.hrMin', { hours, minutes: rest });
}
