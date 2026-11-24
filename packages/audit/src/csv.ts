import type { AuditRecord } from './query';

const FORMULA_START = /^[=+\-@\t\r]/;

/** One CSV cell. A leading formula character gets a quote prefix so spreadsheets show text, not a formula. */
export function csvCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  let text = value instanceof Date ? value.toISOString() : String(value);
  if (FORMULA_START.test(text)) text = `'${text}`;
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

const HEADERS = [
  'id',
  'occurred_at',
  'actor_account_id',
  'actor_role',
  'action',
  'outcome',
  'target_type',
  'target_id',
  'ip',
  'request_id',
  'summary',
] as const;

/** The header line, without the line break. */
export const AUDIT_CSV_HEADER = HEADERS.join(',');

/** One row, without the line break. Used by the background export, which writes row by row. */
export function auditCsvLine(row: AuditRecord): string {
  const summary = typeof row.metadata.summary === 'string' ? row.metadata.summary : '';
  return [
    row.id,
    row.occurredAt,
    row.actorAccountId,
    row.actorRole,
    row.action,
    row.outcome,
    row.targetType,
    row.targetId,
    row.ipTrunc,
    row.requestId,
    summary,
  ]
    .map(csvCell)
    .join(',');
}

export function auditCsv(rows: AuditRecord[]): string {
  const lines = [AUDIT_CSV_HEADER, ...rows.map(auditCsvLine)];
  return `${lines.join('\n')}\n`;
}

export const TITLE_DAILY_CSV_HEADER = 'day,video_id,title,archived,views,watch_seconds,completions,likes,loves,not_for_me,positive_share_percent';

export interface TitleDailyCsvRow {
  day: string;
  videoId: string;
  title: string;
  archived: boolean;
  views: number;
  watchMs: number;
  completions: number;
  /** Lifetime rating counts for the title. Absent when the title has no ratings row. */
  likes?: number;
  loves?: number;
  dislikes?: number;
  /** Whole percent, or null under ten ratings. */
  positiveShare?: number | null;
}

/** One analytics export row (M19-S05), without the line break. */
export function titleDailyCsvLine(row: TitleDailyCsvRow): string {
  return [
    row.day,
    row.videoId,
    row.title,
    row.archived ? 'yes' : 'no',
    row.views,
    Math.round(row.watchMs / 1000),
    row.completions,
    row.likes ?? '',
    row.loves ?? '',
    row.dislikes ?? '',
    row.positiveShare ?? '',
  ]
    .map(csvCell)
    .join(',');
}
