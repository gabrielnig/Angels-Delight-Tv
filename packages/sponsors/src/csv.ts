import type { Report, StatRow } from './report';

export const REPORT_CSV_HEADER = [
  'sponsor',
  'day',
  'creative',
  'placement',
  'impressions',
  'clicks',
  'click_rate',
  'daily_reach',
] as const;

/**
 * One CSV cell. Text that starts with = + - @ tab or carriage return gets a leading quote so a spreadsheet never
 * runs it as a formula. Numbers are written as they are.
 */
export function csvCell(value: string | number): string {
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : '0';
  let text = value;
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export interface CsvDetail {
  rows: StatRow[];
}

/**
 * The report as CSV, one line per day, creative and placement that has data. No viewer, profile or account
 * column exists, so there is nothing personal to leak.
 */
export function reportToCsv(report: Report, sponsorName: string, detail?: CsvDetail): string {
  const names = new Map(report.byCreative.map((c) => [c.creativeId, c.headline]));
  const lines: string[] = [REPORT_CSV_HEADER.join(',')];
  const rows = detail?.rows ?? [];
  const sorted = [...rows].sort(
    (a, b) => a.day.localeCompare(b.day) || a.creativeId.localeCompare(b.creativeId) || a.slot.localeCompare(b.slot),
  );
  for (const r of sorted) {
    lines.push(
      [
        csvCell(sponsorName),
        csvCell(r.day),
        csvCell(names.get(r.creativeId) ?? 'Removed creative'),
        csvCell(r.slot),
        csvCell(r.impressions),
        csvCell(r.clicks),
        csvCell(r.impressions > 0 ? Number((r.clicks / r.impressions).toFixed(6)) : 0),
        csvCell(r.reach),
      ].join(','),
    );
  }
  return `${lines.join('\r\n')}\r\n`;
}
