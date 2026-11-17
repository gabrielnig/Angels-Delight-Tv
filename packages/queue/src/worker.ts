import type { Logger } from '@ad/shared';
import type { BossLike } from './boss';
import {
  CRON_SCHEDULES,
  QUEUES,
  QUEUE_DEFINITIONS,
  parsePayload,
  queueOptions,
  type PayloadOf,
  type QueueName,
} from './definitions';
import type { FailureRecord, JobMirror } from './mirror';

/** Throw from a handler when retrying cannot help, for example a corrupt upload. */
export class PermanentJobError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PermanentJobError';
  }
}

export interface ClassifiedFailure extends FailureRecord {
  permanent: boolean;
}

export interface JobContext {
  /** Mirror row id, null for cron jobs and jobs sent without a tracking row. */
  jobId: string | null;
  /** 1 for the first attempt. */
  attempt: number;
  isLastAttempt: boolean;
  signal: AbortSignal;
  progress(stage: string, percent: number): Promise<void>;
}

export interface WorkerRegistration<Q extends QueueName> {
  queue: Q;
  mirror: JobMirror;
  logger: Logger;
  handle(payload: PayloadOf<Q>, job: JobContext): Promise<void>;
  classify?(error: unknown): ClassifiedFailure;
  /** Called once when the job ends in failure for good: permanent error or retries used up. */
  onFailed?(payload: PayloadOf<Q>, failure: ClassifiedFailure): Promise<void>;
  /** Overrides the default concurrency, for example from a setting (M30-S04). */
  concurrency?: number;
}

export async function ensureQueues(boss: BossLike): Promise<void> {
  for (const name of Object.values(QUEUES)) {
    await boss.createQueue(name, queueOptions(name));
  }
}

export async function scheduleCrons(boss: BossLike): Promise<void> {
  for (const entry of CRON_SCHEDULES) {
    await boss.schedule(entry.queue, entry.cron, {}, { tz: entry.timezone, missed: 'once' });
  }
}

const defaultClassify = (error: unknown): ClassifiedFailure => ({
  code: error instanceof PermanentJobError ? 'permanent' : 'error',
  plain:
    error instanceof PermanentJobError
      ? 'This job cannot be completed.'
      : 'Something went wrong. It will try again.',
  detail: error instanceof Error ? error.message : String(error),
  permanent: error instanceof PermanentJobError,
});

/**
 * Wraps a handler with the behaviour every queue shares: validate the payload, keep the mirror row current,
 * retry transient errors through pg-boss, and finish permanent errors without a retry (D-029).
 */
export async function registerWorker<Q extends QueueName>(
  boss: BossLike,
  registration: WorkerRegistration<Q>,
): Promise<void> {
  const { queue, mirror, logger } = registration;
  const definition = QUEUE_DEFINITIONS[queue];
  const classify = registration.classify ?? defaultClassify;

  await boss.work(
    queue,
    {
      localConcurrency: registration.concurrency ?? definition.concurrency,
      pollingIntervalSeconds: 2,
    },
    async (batch) => {
      for (const raw of batch) {
        let payload: PayloadOf<Q>;
        try {
          payload = parsePayload(queue, raw.data);
        } catch (error) {
          logger.error('job payload rejected', { queue, jobId: raw.id, err: error });
          continue;
        }

        const trackingId = (payload as { jobId?: string }).jobId ?? null;
        const attempt = raw.retryCount + 1;
        const isLastAttempt = raw.retryCount >= definition.retryLimit;
        const log = logger.child({ queue, bossJobId: raw.id, attempt });
        if (trackingId) await mirror.running(trackingId, attempt);

        const context: JobContext = {
          jobId: trackingId,
          attempt,
          isLastAttempt,
          signal: raw.signal,
          async progress(stage, percent) {
            if (trackingId) await mirror.progress(trackingId, stage, percent);
          },
        };

        try {
          await registration.handle(payload, context);
          if (trackingId) await mirror.succeeded(trackingId);
          log.info('job finished');
        } catch (error) {
          const failure = classify(error);
          if (failure.permanent) {
            log.warn('job failed permanently', { code: failure.code, detail: failure.detail });
            if (trackingId) await mirror.failed(trackingId, failure, true);
            await registration.onFailed?.(payload, failure);
            continue;
          }
          if (isLastAttempt) {
            log.error('job failed after retries', { code: failure.code, detail: failure.detail });
            if (trackingId) await mirror.failed(trackingId, failure, false);
            await registration.onFailed?.(payload, failure);
          } else {
            log.warn('job attempt failed, will retry', {
              code: failure.code,
              detail: failure.detail,
            });
            if (trackingId) await mirror.retrying(trackingId, failure);
          }
          throw error;
        }
      }
    },
  );
}
