import 'server-only';
import { countAudit, getAuditEntry, listAudit } from '@ad/audit';
import type { AuditFilters } from '@ad/audit';
import { getServices } from '@/lib/runtime/services';
import { toAdminRow } from './audit-adapter';
import type { AuditQuery } from './audit-adapter';
import type { AuditRow } from './types';

/** Staff roles map to the package scope: admins (super admins in the brief) see every namespace. */
const filtersOf = (q: AuditQuery): AuditFilters => ({
  action: q.action,
  actorAccountId: q.actor && /^[0-9a-f-]{36}$/i.test(q.actor) ? q.actor : undefined,
  targetId: q.target,
  outcome: q.outcome,
  from: q.from ? new Date(`${q.from}T00:00:00Z`) : undefined,
  to: q.to ? new Date(Date.parse(`${q.to}T00:00:00Z`) + 86_400_000) : undefined,
  scope: 'all',
});

export const realAudit = {
  async list(
    q: AuditQuery,
    limit: number,
  ): Promise<{ items: AuditRow[]; nextCursor: string | null }> {
    const page = await listAudit(getServices().db, filtersOf(q), { cursor: q.cursor, limit });
    return { items: page.items.map(toAdminRow), nextCursor: page.nextCursor };
  },
  async get(id: number): Promise<AuditRow | null> {
    const record = await getAuditEntry(getServices().db, id, 'all');
    return record ? toAdminRow(record) : null;
  },
  async exportRows(q: AuditQuery, max: number): Promise<{ rows: AuditRow[]; total: number }> {
    const db = getServices().db;
    const filters = filtersOf(q);
    const [total, page] = await Promise.all([
      countAudit(db, filters),
      listAudit(db, filters, { limit: max }),
    ]);
    return { rows: page.items.map(toAdminRow), total };
  },
};
