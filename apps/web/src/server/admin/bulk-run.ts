import 'server-only';
import { recordAudit } from '@ad/audit';
import { adminDataMode } from '@/lib/data/admin/mode';
import { adminRuntime } from './runtime';
import { recordBulk, type BulkActor, type BulkRecord } from './bulk-audit';

/**
 * Writes the `bulk.run` summary for a run (D-177). Real mode only: fixtures have no audit table. A failed
 * write is swallowed so a logging fault never turns a finished run into an error.
 */
export async function auditBulkRun(actor: BulkActor, record: BulkRecord): Promise<void> {
  if (adminDataMode() !== 'real') return;
  const db = adminRuntime().db();
  await recordBulk((entry) => recordAudit(db, entry), actor, { ...record, itemRows: false });
}
