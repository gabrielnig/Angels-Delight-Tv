import type { Database } from '@ad/db';
import { jobs } from '@ad/db';
import { and, eq, inArray, isNotNull, lt, sql } from 'drizzle-orm';
import type { QueueName } from './definitions';

export interface OpenInput {
  queue: QueueName;
  videoId?: string;
  assetId?: string;
  createdBy?: string;
}

export interface FailureRecord {
  code: string;
  /** Plain words, safe to show an admin. */
  plain: string;
  /** For the developer only. */
  detail: string;
}

/** The `jobs` table the admin screens read. pg-boss owns its own schema, this mirrors what admins need. */
export interface JobMirror {
  /** Inserts a queued row, or returns the open one for the same queue and video. */
  open(input: OpenInput): Promise<{ id: string; created: boolean }>;
  /** Removes a row whose job never reached the queue. */
  discard(id: string): Promise<void>;
  attach(id: string, bossJobId: string | null): Promise<void>;
  running(id: string, attempt: number): Promise<void>;
  progress(id: string, stage: string, percent: number): Promise<void>;
  succeeded(id: string): Promise<void>;
  /** Between attempts: back to queued, keeping the last reason visible. */
  retrying(id: string, failure: FailureRecord): Promise<void>;
  failed(id: string, failure: FailureRecord, permanent: boolean): Promise<void>;
}

const clamp = (value: number) => Math.max(0, Math.min(100, Math.round(value)));

export class DrizzleJobMirror implements JobMirror {
  constructor(private readonly db: Database) {}

  async open(input: OpenInput) {
    const inserted = await this.db
      .insert(jobs)
      .values({
        queue: input.queue,
        videoId: input.videoId,
        assetId: input.assetId,
        createdBy: input.createdBy,
        stage: 'Queued',
      })
      .onConflictDoNothing()
      .returning({ id: jobs.id });
    if (inserted[0]) return { id: inserted[0].id, created: true };
    if (!input.videoId) throw new Error('Could not create a job row');
    const [existing] = await this.db
      .select({ id: jobs.id })
      .from(jobs)
      .where(
        and(
          eq(jobs.queue, input.queue),
          eq(jobs.videoId, input.videoId),
          inArray(jobs.status, ['queued', 'running']),
        ),
      )
      .limit(1);
    if (!existing) throw new Error('Job row conflict could not be resolved');
    return { id: existing.id, created: false };
  }

  async discard(id: string) {
    await this.db.delete(jobs).where(eq(jobs.id, id));
  }

  async attach(id: string, bossJobId: string | null) {
    await this.db.update(jobs).set({ bossJobId }).where(eq(jobs.id, id));
  }

  async running(id: string, attempt: number) {
    await this.db
      .update(jobs)
      .set({
        status: 'running',
        attempts: attempt,
        startedAt: sql`coalesce(${jobs.startedAt}, now())`,
        heartbeatAt: sql`now()`,
      })
      .where(eq(jobs.id, id));
  }

  async progress(id: string, stage: string, percent: number) {
    await this.db
      .update(jobs)
      .set({ stage, progress: clamp(percent), heartbeatAt: sql`now()` })
      .where(eq(jobs.id, id));
  }

  async succeeded(id: string) {
    await this.db
      .update(jobs)
      .set({
        status: 'succeeded',
        stage: 'Done',
        progress: 100,
        finishedAt: sql`now()`,
        errorCode: null,
        errorMessage: null,
        errorDetail: null,
      })
      .where(eq(jobs.id, id));
  }

  async retrying(id: string, failure: FailureRecord) {
    await this.db
      .update(jobs)
      .set({
        status: 'queued',
        stage: 'Waiting to retry',
        errorCode: failure.code,
        errorMessage: failure.plain,
        errorDetail: failure.detail.slice(0, 4000),
      })
      .where(eq(jobs.id, id));
  }

  async failed(id: string, failure: FailureRecord, permanent: boolean) {
    await this.db
      .update(jobs)
      .set({
        status: permanent ? 'failed_permanent' : 'failed',
        stage: 'Failed',
        finishedAt: sql`now()`,
        errorCode: failure.code,
        errorMessage: failure.plain,
        errorDetail: failure.detail.slice(0, 4000),
      })
      .where(eq(jobs.id, id));
  }

  /** Running jobs whose heartbeat is older than the cutoff, for the Stalled badge and alerts (M14-S05). */
  async stalled(
    olderThanSeconds: number,
  ): Promise<{ id: string; queue: string; videoId: string | null }[]> {
    return this.db
      .select({ id: jobs.id, queue: jobs.queue, videoId: jobs.videoId })
      .from(jobs)
      .where(
        and(
          eq(jobs.status, 'running'),
          isNotNull(jobs.heartbeatAt),
          lt(jobs.heartbeatAt, sql`now() - make_interval(secs => ${olderThanSeconds})`),
        ),
      );
  }
}
