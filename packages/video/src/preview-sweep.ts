import { schema, type Database } from '@ad/db';
import type { JobProducer } from '@ad/queue';
import { and, asc, eq, inArray, isNotNull, isNull, ne } from 'drizzle-orm';
import { PREVIEW_SWEEP_BATCH } from './preview';

const { videos } = schema;

/**
 * Hourly backfill (M41, plan 4.3): queues clips for published, live videos that never had one. Each video is marked
 * `queued` first, so the next run skips it. A small batch keeps the encoder free for real uploads.
 */
export async function sweepPreviews(
  deps: { db: Database; producer: Pick<JobProducer, 'enqueue'> },
  limit = PREVIEW_SWEEP_BATCH,
): Promise<number> {
  const due = await deps.db
    .select({ id: videos.id })
    .from(videos)
    .where(
      and(
        eq(videos.previewState, 'none'),
        ne(videos.previewMode, 'off'),
        eq(videos.publishState, 'published'),
        eq(videos.status, 'ready'),
        isNull(videos.deletedAt),
        isNotNull(videos.originalKey),
      ),
    )
    .orderBy(asc(videos.updatedAt))
    .limit(limit);
  if (due.length === 0) return 0;
  await deps.db
    .update(videos)
    .set({ previewState: 'queued', updatedAt: new Date() })
    .where(
      inArray(
        videos.id,
        due.map((row) => row.id),
      ),
    );
  for (const { id } of due) await deps.producer.enqueue('video.preview', { videoId: id });
  return due.length;
}
