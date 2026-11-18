import { sql, type SQL } from 'drizzle-orm';
import type { AuditOutcome } from './entry';

export interface SqlExecutor {
  execute(query: SQL): PromiseLike<unknown>;
}

function rowsOf<T>(result: unknown): T[] {
  if (Array.isArray(result)) return result as T[];
  const rows = (result as { rows?: unknown } | null)?.rows;
  return Array.isArray(rows) ? (rows as T[]) : [];
}

export interface AuditRecord {
  id: number;
  occurredAt: Date;
  actorAccountId: string | null;
  actorRole: string | null;
  action: string;
  outcome: AuditOutcome;
  targetType: string | null;
  targetId: string | null;
  ipTrunc: string | null;
  requestId: string | null;
  metadata: Record<string, unknown>;
}

/** Namespaces that belong to security and operations, not content work. Only a Super admin sees them (M20-S02 AC3). */
export const SECURITY_PREFIXES = [
  'auth.',
  'account.',
  'mfa.',
  'session.',
  'security.',
  'user.',
  'rate_limit.',
  'authz.',
  'audit.',
  'admin.',
  'staff.',
  'role.',
  'job.',
] as const;

export function isSecurityAction(action: string): boolean {
  return SECURITY_PREFIXES.some((prefix) => action.startsWith(prefix));
}

export function encodeCursor(id: number): string {
  return Buffer.from(JSON.stringify({ id })).toString('base64url');
}

/** Returns the id inside a cursor, or null for anything that is not one we made. */
export function decodeCursor(cursor: string | null | undefined): number | null {
  if (!cursor) return null;
  try {
    const parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as {
      id?: unknown;
    };
    return typeof parsed.id === 'number' && Number.isSafeInteger(parsed.id) && parsed.id > 0
      ? parsed.id
      : null;
  } catch {
    return null;
  }
}

export interface AuditFilters {
  actorAccountId?: string;
  /** Exact action, or a prefix ending in a dot such as `video.`. */
  action?: string;
  targetType?: string;
  targetId?: string;
  outcome?: AuditOutcome;
  /** Inclusive start and exclusive end instants. */
  from?: Date;
  to?: Date;
  /** `content` hides security namespaces for the Admin role. */
  scope?: 'all' | 'content';
}

export interface AuditPage {
  items: AuditRecord[];
  nextCursor: string | null;
}

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;
const likeEscape = (text: string): string => text.replace(/[\\%_]/g, (char) => `\\${char}`);

function where(filters: AuditFilters, beforeId: number | null): SQL {
  const parts: SQL[] = [sql`true`];
  if (beforeId !== null) parts.push(sql`id < ${beforeId}`);
  if (filters.actorAccountId) parts.push(sql`actor_account_id = ${filters.actorAccountId}::uuid`);
  if (filters.action) {
    parts.push(
      filters.action.endsWith('.')
        ? sql`action LIKE ${`${likeEscape(filters.action)}%`}`
        : sql`action = ${filters.action}`,
    );
  }
  if (filters.targetType) parts.push(sql`target_type = ${filters.targetType}`);
  if (filters.targetId) parts.push(sql`target_id = ${filters.targetId}`);
  if (filters.outcome) parts.push(sql`outcome = ${filters.outcome}`);
  if (filters.from) parts.push(sql`occurred_at >= ${filters.from.toISOString()}::timestamptz`);
  if (filters.to) parts.push(sql`occurred_at < ${filters.to.toISOString()}::timestamptz`);
  if (filters.scope === 'content') {
    for (const prefix of SECURITY_PREFIXES)
      parts.push(sql`action NOT LIKE ${`${likeEscape(prefix)}%`}`);
  }
  return sql.join(parts, sql` AND `);
}

interface Row {
  id: string | number;
  occurred_at: Date | string;
  actor_account_id: string | null;
  actor_role: string | null;
  action: string;
  outcome: AuditOutcome;
  target_type: string | null;
  target_id: string | null;
  ip_trunc: string | null;
  request_id: string | null;
  metadata: Record<string, unknown>;
}

const toRecord = (row: Row): AuditRecord => ({
  id: Number(row.id),
  occurredAt: new Date(row.occurred_at),
  actorAccountId: row.actor_account_id,
  actorRole: row.actor_role,
  action: row.action,
  outcome: row.outcome,
  targetType: row.target_type,
  targetId: row.target_id,
  ipTrunc: row.ip_trunc,
  requestId: row.request_id,
  metadata: row.metadata ?? {},
});

/** Newest first with keyset pagination on the id, which grows with time and has no ties. */
export async function listAudit(
  db: SqlExecutor,
  filters: AuditFilters = {},
  page: { cursor?: string | null; limit?: number } = {},
): Promise<AuditPage> {
  const limit = Math.min(Math.max(page.limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT);
  const rows = rowsOf<Row>(
    await db.execute(sql`
      SELECT id, occurred_at, actor_account_id, actor_role, action, outcome, target_type, target_id,
             ip_trunc, request_id, metadata
      FROM audit_log WHERE ${where(filters, decodeCursor(page.cursor))}
      ORDER BY id DESC LIMIT ${limit + 1}`),
  );
  const items = rows.slice(0, limit).map(toRecord);
  const last = items.at(-1);
  return { items, nextCursor: rows.length > limit && last ? encodeCursor(last.id) : null };
}

export async function getAuditEntry(
  db: SqlExecutor,
  id: number,
  scope: 'all' | 'content' = 'all',
): Promise<AuditRecord | null> {
  const rows = rowsOf<Row>(
    await db.execute(sql`
      SELECT id, occurred_at, actor_account_id, actor_role, action, outcome, target_type, target_id,
             ip_trunc, request_id, metadata
      FROM audit_log WHERE id = ${id} AND ${where({ scope }, null)}`),
  );
  return rows[0] ? toRecord(rows[0]) : null;
}

/** Rows matching the filters, so the screen can decide between a direct download and a background job. */
export async function countAudit(db: SqlExecutor, filters: AuditFilters = {}): Promise<number> {
  const rows = rowsOf<{ n: string }>(
    await db.execute(sql`SELECT count(*) AS n FROM audit_log WHERE ${where(filters, null)}`),
  );
  return Number(rows[0]?.n ?? 0);
}
