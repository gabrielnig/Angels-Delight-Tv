import 'server-only';
import { staffExportKey, staffExports, withAccount } from '@ad/db';
import { Conflict, Forbidden, NotFound, ValidationFailed, isUuid } from '@ad/shared';
import { and, count, desc, eq, inArray } from 'drizzle-orm';
import type { Readable } from 'node:stream';
import { adminRuntime } from '@/server/admin/runtime';
import { can } from '@/lib/admin/can';
import { auditScopeFor } from '../audit-adapter';
import {
  EXPORT_PERMISSION,
  exportFileName,
  exportName,
  parseExportRequest,
  type ExportKind,
  type ExportRequest,
} from '../exports-rules';
import type { AdminActor } from '../types';
import { catalogActor } from './shared';

/** How many exports one person may have waiting or running at once. */
export const MAX_OPEN_EXPORTS = 3;

export type { ExportDto } from '../exports';
import type { ExportDto } from '../exports';

function allow(actor: AdminActor, kind: ExportKind): void {
  if (!can(actor.role, EXPORT_PERMISSION[kind])) throw new Forbidden();
}

/**
 * Background CSV exports (M19-S05, M20-S03). The permission is checked on every call, not only when the export
 * was asked for, and a person can only ever reach their own rows: the table has row level security on the
 * requester, and each query here also filters on it.
 */
export const realExports = {
  async request(actor: AdminActor, request: ExportRequest): Promise<{ id: string }> {
    // Run the input through the same parser as the form, so a direct call cannot store anything it would not.
    const clean = parseExportRequest(request.kind, request.params);
    if (!clean) throw new ValidationFailed({ kind: ['Choose what to export.'] });
    if (clean.kind === 'analytics' && request.kind === 'analytics') {
      const { from, to } = request.params;
      if (clean.params.from !== from || clean.params.to !== to) {
        throw new ValidationFailed({ range: ['Choose a valid range of dates.'] });
      }
    }
    allow(actor, clean.kind);
    const runtime = adminRuntime();
    const who = catalogActor(actor);
    const id = await withAccount(runtime.db(), who, async (tx) => {
      const [open] = await tx
        .select({ n: count() })
        .from(staffExports)
        .where(
          and(
            eq(staffExports.requesterId, actor.accountId),
            inArray(staffExports.status, ['queued', 'running']),
          ),
        );
      if ((open?.n ?? 0) >= MAX_OPEN_EXPORTS) {
        throw new Conflict(
          `You already have ${MAX_OPEN_EXPORTS} exports waiting. Wait for one to finish.`,
        );
      }
      const [row] = await tx
        .insert(staffExports)
        .values({
          requesterId: actor.accountId,
          kind: clean.kind,
          params: clean.params,
          scope: clean.kind === 'audit' ? auditScopeFor(actor.role) : 'all',
        })
        .returning({ id: staffExports.id });
      return row!.id;
    });
    try {
      await runtime.enqueueExport(id);
    } catch (error) {
      await withAccount(runtime.db(), who, (tx) =>
        tx
          .update(staffExports)
          .set({ status: 'failed', error: 'Could not be queued.' })
          .where(eq(staffExports.id, id)),
      );
      // A failed row nobody can retry is only noise; the caller sees the error and asks again.
      throw error;
    }
    return { id };
  },

  async list(actor: AdminActor): Promise<ExportDto[]> {
    const who = catalogActor(actor);
    const rows = await withAccount(adminRuntime().db(), who, (tx) =>
      tx
        .select()
        .from(staffExports)
        .where(eq(staffExports.requesterId, actor.accountId))
        .orderBy(desc(staffExports.createdAt), desc(staffExports.id))
        .limit(50),
    );
    return rows
      .filter((row) => can(actor.role, EXPORT_PERMISSION[row.kind as ExportKind]))
      .filter((row) => row.status !== 'failed' || row.error !== 'Could not be queued.')
      .map((row) => ({
        id: row.id,
        kind: row.kind as ExportKind,
        name: exportName(row.kind as ExportKind),
        status: row.status as ExportDto['status'],
        rows: row.rowCount,
        bytes: row.bytes,
        askedAt: row.createdAt.toISOString(),
        expiresAt: row.expiresAt?.toISOString() ?? null,
        error: row.error,
      }));
  },

  async open(
    actor: AdminActor,
    id: string,
  ): Promise<{ stream: Readable; fileName: string; bytes: number }> {
    if (!isUuid(id)) throw new NotFound('Export not found');
    const runtime = adminRuntime();
    const [row] = await withAccount(runtime.db(), catalogActor(actor), (tx) =>
      tx
        .select()
        .from(staffExports)
        .where(and(eq(staffExports.id, id), eq(staffExports.requesterId, actor.accountId))),
    );
    if (!row) throw new NotFound('Export not found');
    allow(actor, row.kind as ExportKind);
    if (row.status === 'failed') throw new Conflict('This export failed. Ask for it again.');
    if (row.status !== 'ready') throw new Conflict('This export is not ready yet.');
    if (!row.expiresAt || row.expiresAt.getTime() <= runtime.now().getTime()) {
      throw new NotFound('This file has expired. Ask for a new export.');
    }
    // The key is rebuilt from the id. A stored value that differs is never read.
    if (row.fileKey !== staffExportKey(row.id)) throw new NotFound('Export not found');
    const stream = await runtime.originals().get(staffExportKey(row.id));
    return {
      stream,
      fileName: exportFileName(row.kind as ExportKind, row.params, row.createdAt),
      bytes: row.bytes ?? 0,
    };
  },
};
