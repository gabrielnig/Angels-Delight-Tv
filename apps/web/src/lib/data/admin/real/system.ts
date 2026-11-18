import 'server-only';
import { writeAudit } from '@ad/audit';
import { QUEUE_DEFINITIONS, type QueueName } from '@ad/queue';
import { schema, withAccount } from '@ad/db';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { adminRuntime } from '@/server/admin/runtime';
import type { SystemService } from '../services';
import type { JobRecord, StorageUsage } from '../types';
import { catalogActor, need } from './shared';

const KIND: Record<string, JobRecord['kind']> = {
  'video.probe': 'encode',
  'video.encode': 'encode',
  'video.thumbnails': 'encode',
  'video.rekey': 'encode',
  'caption.generate': 'captions',
  'image.process': 'poster',
  'video.purge': 'cleanup',
  'uploads.cleanup': 'cleanup',
  'videos.purge_deleted': 'cleanup',
};

const num = (value: unknown) => Number(value ?? 0);

interface StorageTotals {
  originalBytes: number;
  streamingBytes: number;
  originalFiles: number;
  streamingFiles: number;
  posterBytes: number;
  posterFiles: number;
  captionBytes: number;
  captionFiles: number;
  otherBytes: number;
  otherFiles: number;
  growth30Bytes: number;
}

/** Sizes come from catalog records, not from listing the buckets, so they are cheap and slightly behind. */
export async function readStorageTotals(): Promise<StorageTotals> {
  const result = await adminRuntime().db().execute(sql`
    SELECT
      (SELECT coalesce(sum(original_bytes), 0) FROM videos WHERE original_key IS NOT NULL) AS original_bytes,
      (SELECT count(*) FROM videos WHERE original_key IS NOT NULL) AS original_files,
      (SELECT coalesce(sum(total_bytes), 0) FROM renditions) AS streaming_bytes,
      (SELECT coalesce(sum(segment_count), 0) FROM renditions) AS streaming_files,
      (SELECT coalesce(sum((e ->> 'bytes')::bigint), 0) FROM assets a, jsonb_array_elements(a.variants) e) AS poster_bytes,
      (SELECT count(*) FROM assets a, jsonb_array_elements(a.variants) e) AS poster_files,
      (SELECT coalesce(sum(bytes), 0) FROM captions) AS caption_bytes,
      (SELECT count(*) FROM captions) AS caption_files,
      (SELECT coalesce(sum(size_bytes), 0) FROM upload_sessions WHERE status IN ('initiated', 'uploading')) AS other_bytes,
      (SELECT count(*) FROM upload_sessions WHERE status IN ('initiated', 'uploading')) AS other_files,
      ((SELECT coalesce(sum(original_bytes), 0) FROM videos WHERE original_key IS NOT NULL AND created_at > now() - interval '30 days')
        + (SELECT coalesce(sum(total_bytes), 0) FROM renditions WHERE created_at > now() - interval '30 days')) AS growth30_bytes`);
  const row = result.rows[0] as Record<string, unknown>;
  return {
    originalBytes: num(row.original_bytes),
    originalFiles: num(row.original_files),
    streamingBytes: num(row.streaming_bytes),
    streamingFiles: num(row.streaming_files),
    posterBytes: num(row.poster_bytes),
    posterFiles: num(row.poster_files),
    captionBytes: num(row.caption_bytes),
    captionFiles: num(row.caption_files),
    otherBytes: num(row.other_bytes),
    otherFiles: num(row.other_files),
    growth30Bytes: num(row.growth30_bytes),
  };
}

export const DEFAULT_STORAGE_CAP_BYTES = 200 * 1024 ** 3;

export async function readStorageCap(): Promise<number> {
  const [row] = await adminRuntime()
    .db()
    .select({ value: schema.settings.value })
    .from(schema.settings)
    .where(eq(schema.settings.key, 'limits.storage_cap_bytes'));
  const value = typeof row?.value === 'number' ? row.value : Number(row?.value);
  return Number.isFinite(value) && value > 0 ? value : DEFAULT_STORAGE_CAP_BYTES;
}

export const realSystemService: SystemService = {
  async jobs(actor) {
    need(actor, 'system.jobs');
    const rows = await adminRuntime().db().execute(sql`
        SELECT j.id, j.queue, j.status, j.attempts, j.error_message, j.finished_at, j.created_at, v.title
        FROM jobs j LEFT JOIN videos v ON v.id = j.video_id
        WHERE j.status IN ('failed', 'failed_permanent')
        ORDER BY coalesce(j.finished_at, j.created_at) DESC, j.id LIMIT 200`);
    return rows.rows.map((r) => {
      const row = r as Record<string, unknown>;
      const queue = String(row.queue);
      const def = QUEUE_DEFINITIONS[queue as QueueName];
      return {
        id: String(row.id),
        kind: KIND[queue] ?? 'cleanup',
        state: row.status === 'failed_permanent' ? 'dead' : 'failed',
        subject: (row.title as string | null) ?? 'Site task',
        attempts: num(row.attempts),
        maxAttempts: def ? def.retryLimit + 1 : 1,
        lastError: (row.error_message as string | null) ?? 'No details were recorded.',
        failedAt: new Date((row.finished_at ?? row.created_at) as string | Date).toISOString(),
      } satisfies JobRecord;
    });
  },

  async retryJob(actor, id) {
    need(actor, 'system.jobs');
    const db = adminRuntime().db();
    const who = catalogActor(actor);
    const job = await withAccount(db, who, async (tx) => {
      const [row] = await tx
        .select()
        .from(schema.jobs)
        .where(
          and(eq(schema.jobs.id, id), inArray(schema.jobs.status, ['failed', 'failed_permanent'])),
        )
        .for('update');
      if (!row) return null;
      await tx
        .update(schema.jobs)
        .set({ status: 'cancelled', stage: 'Replaced by a retry' })
        .where(eq(schema.jobs.id, id));
      await writeAudit(tx, {
        action: 'job.retry',
        outcome: 'success',
        actorAccountId: actor.accountId,
        actorRole: actor.role,
        targetType: 'job',
        targetId: id,
        summary: `Queued ${row.queue} again`,
        extra: { queue: row.queue, videoId: row.videoId },
      });
      return row;
    });
    if (!job) return { ok: false, error: 'That job is already gone.' };
    const payload = job.videoId ? { videoId: job.videoId } : { assetId: job.assetId! };
    await adminRuntime().enqueue(job.queue as QueueName, payload as never, {
      createdBy: actor.accountId,
    });
    return { ok: true };
  },

  async discardJob(actor, id, reason) {
    need(actor, 'system.jobs');
    if (reason.trim().length < 3)
      return { ok: false, error: 'Write a short reason. It is kept in the audit log.' };
    return withAccount(adminRuntime().db(), catalogActor(actor), async (tx) => {
      const [row] = await tx
        .update(schema.jobs)
        .set({ status: 'cancelled', stage: 'Discarded' })
        .where(
          and(eq(schema.jobs.id, id), inArray(schema.jobs.status, ['failed', 'failed_permanent'])),
        )
        .returning();
      if (!row) return { ok: false as const, error: 'That job is already gone.' };
      await writeAudit(tx, {
        action: 'job.discard',
        outcome: 'success',
        actorAccountId: actor.accountId,
        actorRole: actor.role,
        targetType: 'job',
        targetId: id,
        summary: `Discarded ${row.queue}`,
        extra: { reason: reason.trim(), queue: row.queue, videoId: row.videoId },
      });
      return { ok: true as const };
    });
  },

  async storage(actor) {
    need(actor, 'system.view');
    const t = await readStorageTotals();
    return [
      {
        type: 'video',
        bytes: t.originalBytes + t.streamingBytes,
        files: t.originalFiles + t.streamingFiles,
      },
      { type: 'poster', bytes: t.posterBytes, files: t.posterFiles },
      { type: 'caption', bytes: t.captionBytes, files: t.captionFiles },
      { type: 'other', bytes: t.otherBytes, files: t.otherFiles },
    ] satisfies StorageUsage[];
  },

  async quality(actor) {
    need(actor, 'system.view');
    return (await import('../analytics-quality-real')).realQuality();
  },
};
