import type { BossLike } from './boss';
import { parsePayload, type PayloadInput, type QueueName } from './definitions';
import type { JobMirror } from './mirror';

export interface EnqueueOptions {
  createdBy?: string;
  startAfterSeconds?: number;
}

export interface EnqueueResult {
  /** The mirror row id, which the admin screens use. */
  jobId: string;
  /** True when an open job for the same video already existed, so nothing new was queued. */
  deduped: boolean;
}

/**
 * Used by apps/web (through a producer-only pg-boss client) and by the worker to chain jobs.
 * One open job per queue and video is enforced by the unique partial index on `jobs`.
 */
export class JobProducer {
  private readonly boss: BossLike;
  private readonly mirror: JobMirror;

  constructor(deps: { boss: BossLike; mirror: JobMirror }) {
    this.boss = deps.boss;
    this.mirror = deps.mirror;
  }

  async enqueue<Q extends QueueName>(
    queue: Q,
    payload: PayloadInput<Q>,
    options: EnqueueOptions = {},
  ): Promise<EnqueueResult> {
    const parsed = parsePayload(queue, payload) as { videoId?: string; assetId?: string };
    const row = await this.mirror.open({
      queue,
      videoId: parsed.videoId,
      assetId: parsed.assetId,
      createdBy: options.createdBy,
    });
    if (!row.created) return { jobId: row.id, deduped: true };

    try {
      const bossJobId = await this.boss.send(
        queue,
        { ...parsed, jobId: row.id },
        {
          singletonKey: parsed.videoId ?? parsed.assetId,
          ...(options.startAfterSeconds ? { startAfter: options.startAfterSeconds } : {}),
        },
      );
      await this.mirror.attach(row.id, bossJobId);
    } catch (error) {
      await this.mirror.discard(row.id);
      throw error;
    }
    return { jobId: row.id, deduped: false };
  }
}
