import { schema, type Database } from '@ad/db';
import type { JobProducer } from '@ad/queue';
import { createLogger, type Logger } from '@ad/shared';
import type { StorageAdapter } from '@ad/storage';
import { and, eq, isNotNull, lt } from 'drizzle-orm';

const { videos } = schema;

export interface LifecycleDeps {
  db: Database;
  originals: StorageAdapter;
  media: StorageAdapter;
  producer: Pick<JobProducer, 'enqueue'>;
  /** Days a soft deleted video stays recoverable before its files are removed. */
  graceDays?: number;
  clock?: () => Date;
  logger?: Logger;
}

/** M22 storage lifecycle: deleting a video for good and finding the ones due for it. */
export class LifecycleService {
  private readonly clock: () => Date;
  private readonly logger: Logger;

  constructor(private readonly deps: LifecycleDeps) {
    this.clock = deps.clock ?? (() => new Date());
    this.logger = deps.logger ?? createLogger({ write: () => undefined });
  }

  /**
   * The `video.purge` job. Deletes every object that belongs to the video, then the row. Safe to repeat: deleting
   * a prefix that is already empty succeeds, and a missing row means there is nothing left to do.
   */
  async purge(videoId: string): Promise<void> {
    const { db, originals, media } = this.deps;
    const [video] = await db.select().from(videos).where(eq(videos.id, videoId)).limit(1);
    if (!video) return;
    if (!video.deletedAt) throw new Error(`video ${videoId} is not deleted, refusing to purge`);
    await media.deletePrefix(`v/${video.mediaPrefix}/`);
    await media.deletePrefix(`cap/${video.mediaPrefix}/`);
    await originals.deletePrefix(`originals/${videoId}/`);
    await originals.deletePrefix(`templates/${videoId}/`);
    await originals.deletePrefix(`captions-draft/${videoId}/`);
    await originals.delete(`scripts/${videoId}.txt`);
    await db.delete(videos).where(and(eq(videos.id, videoId), isNotNull(videos.deletedAt)));
    this.logger.info('video purged', { videoId });
  }

  /** The `videos.purge_deleted` cron: queues a purge for each video deleted longer ago than the grace period. */
  async enqueueExpired(): Promise<{ queued: number }> {
    const cutoff = new Date(this.clock().getTime() - (this.deps.graceDays ?? 30) * 86_400_000);
    const due = await this.deps.db
      .select({ id: videos.id })
      .from(videos)
      .where(and(isNotNull(videos.deletedAt), lt(videos.deletedAt, cutoff)));
    for (const row of due) await this.deps.producer.enqueue('video.purge', { videoId: row.id });
    return { queued: due.length };
  }
}
