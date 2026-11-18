import 'server-only';
import { countAudit, getAuditEntry, iterateAudit, listAudit } from '@ad/audit';
import type { AuditFilters } from '@ad/audit';
import { getServices } from '@/lib/runtime/services';
import { toAdminRow } from './audit-adapter';
import type { AuditQuery, AuditScope } from './audit-adapter';
import type { AuditRow } from './types';

/** A Super admin reads every namespace, admins read content actions only (M20-S02 AC3). */
const filtersOf = (q: AuditQuery, scope: AuditScope): AuditFilters => ({
  action: q.action,
  actorAccountId: q.actor && /^[0-9a-f-]{36}$/i.test(q.actor) ? q.actor : undefined,
  targetId: q.target,
  outcome: q.outcome,
  from: q.from ? new Date(`${q.from}T00:00:00Z`) : undefined,
  to: q.to ? new Date(Date.parse(`${q.to}T00:00:00Z`) + 86_400_000) : undefined,
  scope,
});

export const realAudit = {
  async list(
    q: AuditQuery,
    limit: number,
    scope: AuditScope,
  ): Promise<{ items: AuditRow[]; nextCursor: string | null }> {
    const page = await listAudit(getServices().db, filtersOf(q, scope), {
      cursor: q.cursor,
      limit,
    });
    return { items: page.items.map(toAdminRow), nextCursor: page.nextCursor };
  },
  async get(id: number, scope: AuditScope): Promise<AuditRow | null> {
    const record = await getAuditEntry(getServices().db, id, scope);
    return record ? toAdminRow(record) : null;
  },
  async count(q: AuditQuery, scope: AuditScope): Promise<number> {
    return countAudit(getServices().db, filtersOf(q, scope));
  },
  async exportRows(
    q: AuditQuery,
    max: number,
    scope: AuditScope,
  ): Promise<{ rows: AuditRow[]; total: number }> {
    const db = getServices().db;
    const filters = filtersOf(q, scope);
    const total = await countAudit(db, filters);
    // The screen list stops at 200 a page; the export reads as many pages as it needs, up to `max`.
    const records = [];
    for await (const page of iterateAudit(db, filters, { pageSize: 1000 })) {
      records.push(...page);
      if (records.length >= max) break;
    }
    return { rows: records.slice(0, max).map(toAdminRow), total };
  },
};
