import type { AuditEntry } from '@ad/audit';
import type { BulkOutcome } from '@/lib/data/admin/bulk';

/** Max ids kept in the summary row. The per item rows hold the full detail. */
export const SUMMARY_ID_CAP = 50;

export interface BulkActor {
  accountId: string;
  role: string;
}

export interface BulkRecord {
  /** The item action, for example `video.publish`. */
  action: string;
  label: string;
  targetType: string;
  bulkId: string;
  ids: readonly string[];
  outcome?: BulkOutcome;
  /** The run was refused before any item was touched. */
  denied?: boolean;
  /** Write one normal row per succeeded id. Callers that audit inside their own transaction pass false. */
  itemRows?: boolean;
}

/**
 * Writes the audit trail for a bulk run (decision D-177): one `bulk.run` summary row plus, unless the caller
 * already wrote them, one normal item row per changed id carrying the same `bulkId`.
 */
export async function recordBulk(
  write: (entry: AuditEntry) => Promise<void>,
  actor: BulkActor,
  record: BulkRecord,
): Promise<void> {
  const { outcome } = record;
  const base = { actorAccountId: actor.accountId, actorRole: actor.role };
  const shown = record.ids.slice(0, SUMMARY_ID_CAP);

  await write({
    ...base,
    action: 'bulk.run',
    outcome: record.denied ? 'denied' : 'success',
    targetType: record.targetType,
    summary: record.denied ? `${record.label} was refused` : `${record.label}: ${outcome?.succeeded.length ?? 0} changed`,
    extra: {
      bulkId: record.bulkId,
      label: record.label,
      itemAction: record.action,
      requested: record.ids.length,
      succeeded: outcome?.succeeded.length ?? 0,
      failed: outcome?.failed.length ?? 0,
      skipped: outcome?.skipped.length ?? 0,
      ids: shown,
      idsTruncated: record.ids.length > SUMMARY_ID_CAP,
    },
  });

  if (record.denied || !outcome || record.itemRows === false) return;
  for (const id of outcome.succeeded) {
    await write({
      ...base,
      action: record.action,
      outcome: 'success',
      targetType: record.targetType,
      targetId: id,
      extra: { bulkId: record.bulkId },
    });
  }
}
