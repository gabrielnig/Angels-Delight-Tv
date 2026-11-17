import { sql } from 'drizzle-orm';
import { writeAudit } from './writer';
import type { SqlExecutor } from './query';
import type { Database } from '@ad/db';

export const DEFAULT_AUDIT_RETENTION_MONTHS = 24;
/** Monthly, first day at 03:30 Africa/Lagos (M20-S04). The worker lane registers it. */
export const AUDIT_RETENTION_SCHEDULE = { cron: '30 3 1 * *', timeZone: 'Africa/Lagos' } as const;
const CHUNK = 5000;

export function retentionCutoff(now: Date, months: number): Date {
  const cutoff = new Date(now);
  cutoff.setUTCMonth(cutoff.getUTCMonth() - months);
  return cutoff;
}

export interface PruneOptions {
  now?: Date;
  retentionMonths?: number;
  /** A legal hold pauses the purge entirely (M20-S04 edge). */
  legalHold?: boolean;
}

export interface PruneResult {
  deleted: number;
  cutoff: Date;
  skipped: 'legal_hold' | null;
}

/**
 * Deletes entries older than the retention window and then logs the purge itself. `maintenance` must be a
 * connection as `ad_maintenance`, the only role the append only trigger lets delete. `writer` is a normal app
 * connection, because the maintenance role cannot insert.
 */
export async function pruneAudit(
  maintenance: SqlExecutor,
  writer: Pick<Database, 'insert'>,
  options: PruneOptions = {},
): Promise<PruneResult> {
  const now = options.now ?? new Date();
  const cutoff = retentionCutoff(now, options.retentionMonths ?? DEFAULT_AUDIT_RETENTION_MONTHS);
  if (options.legalHold) {
    await writeAudit(writer, {
      action: 'audit.retention.skipped',
      outcome: 'success',
      summary: 'Audit purge skipped because a legal hold is active',
      extra: { cutoff: cutoff.toISOString() },
    });
    return { deleted: 0, cutoff, skipped: 'legal_hold' };
  }

  let deleted = 0;
  for (;;) {
    const result = (await maintenance.execute(sql`
      WITH doomed AS (
        SELECT id FROM audit_log WHERE occurred_at < ${cutoff.toISOString()}::timestamptz
        ORDER BY id LIMIT ${CHUNK}
      ), gone AS (DELETE FROM audit_log WHERE id IN (SELECT id FROM doomed) RETURNING 1)
      SELECT count(*)::int AS n FROM gone`)) as { rows?: Array<{ n: number }> };
    const n = Number(result.rows?.[0]?.n ?? 0);
    deleted += n;
    if (n < CHUNK) break;
  }

  await writeAudit(writer, {
    action: 'audit.retention.purge',
    outcome: 'success',
    summary: `Purged ${deleted} audit entries older than ${cutoff.toISOString().slice(0, 10)}`,
    extra: { deleted, cutoff: cutoff.toISOString() },
  });
  return { deleted, cutoff, skipped: null };
}
