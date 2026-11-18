import { TITLE_DAILY_CSV_HEADER, titleDailyCsvLine } from '@ad/audit';
import type { TitleDailyRow } from '@ad/analytics';

/** The CSV body for the analytics export: daily views and watch time per title (M19-S05). Headers only when empty. */
export function titleDailyCsv(rows: readonly TitleDailyRow[]): string {
  return `${[TITLE_DAILY_CSV_HEADER, ...rows.map(titleDailyCsvLine)].join('\n')}\n`;
}
