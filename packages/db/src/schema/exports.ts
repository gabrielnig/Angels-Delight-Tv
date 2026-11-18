import { sql } from 'drizzle-orm';
import { bigint, check, index, integer, jsonb, pgTable, text, uuid } from 'drizzle-orm/pg-core';
import { createdAt, pk, timestamptz } from './columns';
import { accounts } from './identity';

export const STAFF_EXPORT_KINDS = ['audit', 'analytics'] as const;
export const STAFF_EXPORT_STATUSES = ['queued', 'running', 'ready', 'failed'] as const;

/** Where the file of an export lives in the private originals bucket. Built from the id only, never from input. */
export const staffExportKey = (id: string): string => `exports/${id}.csv`;

/**
 * A CSV export built by the worker (M19-S05, M20-S03). The file sits in the private originals bucket under
 * `exports/<id>.csv` and is served only to the person who asked, until `expires_at`.
 */
export const staffExports = pgTable(
  'staff_exports',
  {
    id: pk(),
    requesterId: uuid('requester_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'cascade' }),
    kind: text('kind').notNull(),
    /** The filters, already validated: an audit query or an analytics day range. */
    params: jsonb('params').$type<Record<string, string>>().notNull().default({}),
    /** Audit only. Fixed when the export is asked for, from the requester's role, never read from the form. */
    scope: text('scope').notNull().default('all'),
    status: text('status').notNull().default('queued'),
    rowCount: integer('row_count'),
    bytes: bigint('bytes', { mode: 'number' }),
    fileKey: text('file_key'),
    error: text('error'),
    createdAt: createdAt(),
    startedAt: timestamptz('started_at'),
    finishedAt: timestamptz('finished_at'),
    expiresAt: timestamptz('expires_at'),
  },
  (t) => [
    check('staff_exports_kind_known', sql`${t.kind} IN ('audit', 'analytics')`),
    check('staff_exports_scope_known', sql`${t.scope} IN ('all', 'content')`),
    check(
      'staff_exports_status_known',
      sql`${t.status} IN ('queued', 'running', 'ready', 'failed')`,
    ),
    index('staff_exports_requester_idx').on(t.requesterId, t.createdAt),
  ],
);
