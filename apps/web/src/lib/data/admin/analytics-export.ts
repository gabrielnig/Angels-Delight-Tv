import { csvCell } from '@ad/audit';
import type { TitleDailyRow } from '@ad/analytics';

const EXPORT_HEADER = 'day,video_id,title,archived,views,watch_seconds,completions';

/** The CSV body for the analytics export: daily views and watch time per title (M19-S05). Headers only when empty. */
export function titleDailyCsv(rows: readonly TitleDailyRow[]): string {
  const lines = rows.map((row) =>
    [
      row.day,
      row.videoId,
      row.title,
      row.archived ? 'yes' : 'no',
      row.views,
      Math.round(row.watchMs / 1000),
      row.completions,
    ]
      .map(csvCell)
      .join(','),
  );
  return `${[EXPORT_HEADER, ...lines].join('\n')}\n`;
}
