import { sql } from 'drizzle-orm';
import {
  bigint,
  check,
  index,
  integer,
  pgTable,
  smallint,
  text,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { createdAt, pk, timestamptz } from './columns';
import { jobStatus, uploadKind, uploadStatus } from './enums';
import { assets, videos } from './content';
import { accounts } from './identity';

export const uploadSessions = pgTable(
  'upload_sessions',
  {
    id: pk(),
    kind: uploadKind('kind').notNull(),
    videoId: uuid('video_id').references(() => videos.id, { onDelete: 'set null' }),
    assetId: uuid('asset_id').references(() => assets.id, { onDelete: 'set null' }),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => accounts.id, { onDelete: 'cascade' }),
    filename: text('filename').notNull(),
    declaredMime: text('declared_mime').notNull(),
    sizeBytes: bigint('size_bytes', { mode: 'number' }).notNull(),
    partSizeBytes: integer('part_size_bytes').notNull(),
    totalParts: integer('total_parts').notNull(),
    storageKey: text('storage_key').notNull(),
    s3UploadId: text('s3_upload_id').notNull(),
    fingerprint: text('fingerprint').notNull(),
    status: uploadStatus('status').notNull().default('initiated'),
    errorMessage: text('error_message'),
    createdAt: createdAt(),
    expiresAt: timestamptz('expires_at').notNull(),
    completedAt: timestamptz('completed_at'),
  },
  (t) => [
    check('upload_sessions_filename_length', sql`char_length(${t.filename}) BETWEEN 1 AND 255`),
    check('upload_sessions_size_range', sql`${t.sizeBytes} > 0 AND ${t.sizeBytes} <= 17179869184`),
    check('upload_sessions_part_size_min', sql`${t.partSizeBytes} >= 5242880`),
    check('upload_sessions_total_parts_range', sql`${t.totalParts} BETWEEN 1 AND 10000`),
    uniqueIndex('upload_sessions_active_fingerprint_uniq')
      .on(t.createdBy, t.fingerprint)
      .where(sql`${t.status} IN ('initiated', 'uploading')`),
    index('upload_sessions_status_expiry_idx').on(t.status, t.expiresAt),
  ],
);

export const jobs = pgTable(
  'jobs',
  {
    id: pk(),
    queue: text('queue').notNull(),
    bossJobId: uuid('boss_job_id'),
    videoId: uuid('video_id').references(() => videos.id, { onDelete: 'cascade' }),
    assetId: uuid('asset_id').references(() => assets.id, { onDelete: 'cascade' }),
    status: jobStatus('status').notNull().default('queued'),
    stage: text('stage'),
    progress: smallint('progress').notNull().default(0),
    attempts: smallint('attempts').notNull().default(0),
    errorCode: text('error_code'),
    errorMessage: text('error_message'),
    createdBy: uuid('created_by').references(() => accounts.id, { onDelete: 'set null' }),
    createdAt: createdAt(),
    startedAt: timestamptz('started_at'),
    finishedAt: timestamptz('finished_at'),
  },
  (t) => [
    check('jobs_progress_range', sql`${t.progress} BETWEEN 0 AND 100`),
    index('jobs_video_created_idx').on(t.videoId, t.createdAt.desc()),
    index('jobs_open_status_idx')
      .on(t.status, t.createdAt)
      .where(sql`${t.status} IN ('queued', 'running', 'failed')`),
    uniqueIndex('jobs_one_open_per_video_queue_uniq')
      .on(t.queue, t.videoId)
      .where(sql`${t.status} IN ('queued', 'running') AND ${t.videoId} IS NOT NULL`),
  ],
);
