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

export function auditCsv(rows: AuditRecord[]): string {
  const lines = [HEADERS.join(',')];
  for (const row of rows) {
    const summary = typeof row.metadata.summary === 'string' ? row.metadata.summary : '';
    lines.push(
      [
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
        .join(','),
    );
  }
  return `${lines.join('\n')}\n`;
}
