import { auditCsv, isSecurityAction } from '@ad/audit';
import type { AuditRecord } from '@ad/audit';
import { isSuperAdminRole } from '@ad/shared';
import type { AuditRow } from './types';

type Outcome = AuditRow['outcome'];
const OUTCOMES: Outcome[] = ['success', 'failure', 'denied'];

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

/** Maps what @ad/audit returns to the shape the screen uses. */
export function toAdminRow(record: AuditRecord): AuditRow {
  const meta = record.metadata ?? {};
  const actorName = record.actorAccountId
    ? `${record.actorRole ?? 'account'} ${record.actorAccountId.slice(0, 8)}`
    : 'Unknown';
  return {
    id: record.id,
    at: record.occurredAt.toISOString(),
    actorId: record.actorAccountId,
    actorName,
    actorRole: record.actorRole,
    action: record.action,
    outcome: record.outcome,
    targetType: record.targetType,
    targetId: record.targetId,
    summary: typeof meta.summary === 'string' && meta.summary ? meta.summary : record.action,
    before: asRecord(meta.before),
    after: asRecord(meta.after),
    ip: record.ipTrunc,
    requestId: record.requestId,
  };
}

export interface AuditQuery {
  action?: string;
  actor?: string;
  target?: string;
  outcome?: Outcome;
  from?: string;
  to?: string;
  cursor?: string;
  entry?: string;
}

const DAY = /^\d{4}-\d{2}-\d{2}$/;

export function parseAuditQuery(sp: Record<string, string | string[] | undefined>): AuditQuery {
  const one = (key: string) => (typeof sp[key] === 'string' ? (sp[key] as string).trim() : '');
  const query: AuditQuery = {};
  const action = one('action').slice(0, 80);
  if (action) query.action = action;
  const actor = one('actor').slice(0, 80);
  if (actor) query.actor = actor;
  const target = one('target').slice(0, 80);
  if (target) query.target = target;
  const outcome = one('outcome') as Outcome;
  if (OUTCOMES.includes(outcome)) query.outcome = outcome;
  for (const key of ['from', 'to'] as const) if (DAY.test(one(key))) query[key] = one(key);
  const cursor = one('cursor').slice(0, 200);
  if (cursor) query.cursor = cursor;
  if (/^\d{1,12}$/.test(one('entry'))) query.entry = one('entry');
  return query;
}

export function serializeAuditQuery(query: AuditQuery, drop: Array<keyof AuditQuery> = []): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query))
    if (value && !drop.includes(key as keyof AuditQuery)) params.set(key, value);
  return params.toString();
}

/** A Super admin reads the whole log, everyone else sees content actions only (M20-S02 AC3). */
export function auditScopeFor(role: unknown): AuditScope {
  return isSuperAdminRole(role) ? 'all' : 'content';
}
export type AuditScope = 'all' | 'content';

export function filterAudit(
  rows: AuditRow[],
  q: AuditQuery,
  scope: AuditScope = 'all',
): AuditRow[] {
  const from = q.from ? Date.parse(`${q.from}T00:00:00Z`) : null;
  const to = q.to ? Date.parse(`${q.to}T00:00:00Z`) + 86_400_000 : null;
  return rows.filter(
    (r) =>
      (scope === 'all' || !isSecurityAction(r.action)) &&
      (!q.action ||
        (q.action.endsWith('.') ? r.action.startsWith(q.action) : r.action === q.action)) &&
      (!q.actor ||
        r.actorName.toLowerCase().includes(q.actor.toLowerCase()) ||
        r.actorId === q.actor) &&
      (!q.target || r.targetId === q.target || r.targetType === q.target) &&
      (!q.outcome || r.outcome === q.outcome) &&
      (from === null || Date.parse(r.at) >= from) &&
      (to === null || Date.parse(r.at) < to),
  );
}

/** CSV through the package writer, so formula neutralising stays in one place. */
export function toCsv(rows: AuditRow[]): string {
  return auditCsv(
    rows.map((r) => ({
      id: r.id,
      occurredAt: new Date(r.at),
      actorAccountId: r.actorId,
      actorRole: r.actorRole,
      action: r.action,
      outcome: r.outcome,
      targetType: r.targetType,
      targetId: r.targetId,
      ipTrunc: r.ip,
      requestId: r.requestId,
      metadata: { summary: r.summary },
    })),
  );
}
