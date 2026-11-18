import { Readable } from 'node:stream';
import { createAnalyticsQueries, monthChunks } from '@ad/analytics';
import {
  AUDIT_CSV_HEADER,
  TITLE_DAILY_CSV_HEADER,
  auditCsvLine,
  auditFiltersFromParams,
  iterateAudit,
  titleDailyCsvLine,
} from '@ad/audit';
import { staffExportKey, staffExports, type Database } from '@ad/db';
import { enqueueEmail, openStaffAddress } from '@ad/queue';
import type { Logger } from '@ad/shared';
import type { StorageAdapter } from '@ad/storage';
import { and, eq, inArray, lt, or } from 'drizzle-orm';

/** How long a finished file stays downloadable. */
export const EXPORT_KEEP_HOURS = 72;
/** A failed row is kept this long so the person can see why, then it goes. */
export const FAILED_KEEP_DAYS = 7;
/**
 * The ceiling that keeps one export from exhausting the worker. The S3 adapter holds a streamed object in memory
 * while it uploads, and two million audit rows is about 300 MB (D-130).
 */
export const EXPORT_MAX_ROWS = 2_000_000;
const ROWS_PER_READ = 1000;
const TOO_LARGE = 'Too many rows for one file. Narrow the filters or the dates and try again.';
const GENERIC_FAILURE =
  'The file could not be built. Try again, and tell the developer if it keeps failing.';

export const exportKey = staffExportKey;

export interface ExportRuntime {
  db: Database;
  /** The private originals bucket. */
  storage: StorageAdapter;
  kek: Uint8Array;
  logger: Logger;
  now?: () => Date;
  pageSize?: number;
  maxRows?: number;
}

class TooLarge extends Error {
  constructor() {
    super(TOO_LARGE);
    this.name = 'TooLarge';
  }
}

const KIND_NAME = { audit: 'Audit log', analytics: 'Analytics' } as const;

type Row = typeof staffExports.$inferSelect;

async function* lines(
  rt: ExportRuntime,
  row: Row,
  count: { rows: number },
): AsyncGenerator<string> {
  const max = rt.maxRows ?? EXPORT_MAX_ROWS;
  const take = (): void => {
    count.rows += 1;
    if (count.rows > max) throw new TooLarge();
  };
  if (row.kind === 'audit') {
    yield `${AUDIT_CSV_HEADER}\n`;
    const filters = auditFiltersFromParams(row.params, row.scope === 'content' ? 'content' : 'all');
    for await (const page of iterateAudit(rt.db, filters, {
      pageSize: rt.pageSize ?? ROWS_PER_READ,
    })) {
      let chunk = '';
      for (const record of page) {
        take();
        chunk += `${auditCsvLine(record)}\n`;
      }
      yield chunk;
    }
    return;
  }
  yield `${TITLE_DAILY_CSV_HEADER}\n`;
  const queries = createAnalyticsQueries(rt.db);
  const { from, to } = row.params;
  if (!from || !to) return;
  for (const range of monthChunks({ from, to })) {
    let chunk = '';
    for (const record of await queries.titleDaily(range)) {
      take();
      chunk += `${titleDailyCsvLine(record)}\n`;
    }
    if (chunk) yield chunk;
  }
}

async function tell(
  rt: ExportRuntime,
  row: Row,
  kind: 'staff_export_ready' | 'staff_export_failed',
  vars: Record<string, string | number>,
): Promise<void> {
  try {
    const to = await openStaffAddress(rt.db, rt.kek, row.requesterId);
    if (!to) {
      rt.logger.warn('export email skipped: no saved address for the requester', {
        exportId: row.id,
      });
      return;
    }
    await enqueueEmail(rt.db, rt.kek, {
      kind,
      to,
      recipientId: row.requesterId,
      vars,
      dedupeKey: `export:${row.id}`,
      now: rt.now?.(),
    });
  } catch (error) {
    rt.logger.warn('export email not queued', { exportId: row.id, err: error });
  }
}

/**
 * Builds one export (M19-S05, M20-S03). The file is written row by row to the private bucket, the row is marked
 * ready with its size and expiry, and an email goes to the requester through the outbox. A failed attempt that
 * will be retried puts the export back in the queue; the last attempt, or a file that is too large, fails it.
 */
export async function generateExport(
  rt: ExportRuntime,
  exportId: string,
  options: { finalAttempt: boolean },
): Promise<'built' | 'skipped' | 'failed'> {
  const now = rt.now?.() ?? new Date();
  const claimed = await rt.db
    .update(staffExports)
    .set({ status: 'running', startedAt: now, error: null })
    .where(and(eq(staffExports.id, exportId), inArray(staffExports.status, ['queued', 'running'])))
    .returning();
  const row = claimed[0];
  if (!row) return 'skipped';

  const count = { rows: 0 };
  const key = exportKey(row.id);
  try {
    await rt.storage.put(key, Readable.from(lines(rt, row, count)), {
      contentType: 'text/csv; charset=utf-8',
    });
    const info = await rt.storage.head(key);
    const finished = rt.now?.() ?? new Date();
    await rt.db
      .update(staffExports)
      .set({
        status: 'ready',
        rowCount: count.rows,
        bytes: info?.bytes ?? 0,
        fileKey: key,
        finishedAt: finished,
        expiresAt: new Date(finished.getTime() + EXPORT_KEEP_HOURS * 3_600_000),
      })
      .where(eq(staffExports.id, row.id));
    await tell(rt, row, 'staff_export_ready', {
      name: KIND_NAME[row.kind as keyof typeof KIND_NAME] ?? 'Export',
      rows: count.rows,
      hours: EXPORT_KEEP_HOURS,
    });
    return 'built';
  } catch (error) {
    const tooLarge = error instanceof TooLarge;
    await rt.storage.delete(key).catch(() => undefined);
    if (!tooLarge && !options.finalAttempt) {
      await rt.db.update(staffExports).set({ status: 'queued' }).where(eq(staffExports.id, row.id));
      throw error;
    }
    rt.logger.error('export failed', { exportId: row.id, err: error });
    await rt.db
      .update(staffExports)
      .set({
        status: 'failed',
        error: tooLarge ? TOO_LARGE : GENERIC_FAILURE,
        finishedAt: rt.now?.() ?? new Date(),
      })
      .where(eq(staffExports.id, row.id));
    await tell(rt, row, 'staff_export_failed', {
      name: KIND_NAME[row.kind as keyof typeof KIND_NAME] ?? 'Export',
    });
    return 'failed';
  }
}

/** Deletes finished files past their expiry and failed rows older than a week. Returns how many rows went. */
export async function cleanupExports(rt: ExportRuntime): Promise<number> {
  const now = rt.now?.() ?? new Date();
  const old = new Date(now.getTime() - FAILED_KEEP_DAYS * 86_400_000);
  const due = await rt.db
    .select({ id: staffExports.id, fileKey: staffExports.fileKey })
    .from(staffExports)
    .where(
      or(
        and(eq(staffExports.status, 'ready'), lt(staffExports.expiresAt, now)),
        and(eq(staffExports.status, 'failed'), lt(staffExports.createdAt, old)),
      ),
    );
  for (const row of due) {
    if (row.fileKey) await rt.storage.delete(row.fileKey).catch(() => undefined);
    await rt.db.delete(staffExports).where(eq(staffExports.id, row.id));
  }
  return due.length;
}
