import {
  MAIL_CRON_SCHEDULES,
  QUEUES,
  ensureQueues,
  registerWorker,
  scheduleCrons,
  type BossLike,
  type DrainResult,
  type DigestResult,
  type JobMirror,
} from '@ad/queue';
import type { Logger } from '@ad/shared';

export interface MailDeps {
  /** Queues the emails "at once" people asked for. A failure here must not stop the sending below. */
  queueImmediate(): Promise<number>;
  drain(): Promise<DrainResult>;
  /** Drops old sent and failed rows. */
  prune(): Promise<number>;
  digests(): Promise<DigestResult>;
  mirror: JobMirror;
  logger: Logger;
}

/**
 * The mail jobs (M15-S01, M21-S03). `email.outbox` runs every minute: it queues notices for people who want them at
 * once, sends one batch of due mail with retry, and prunes old rows. `email.digest` builds the hourly summaries
 * and, in the 07:00 Lagos hour, the daily ones.
 */
export async function registerMailHandlers(boss: BossLike, deps: MailDeps): Promise<void> {
  const { mirror, logger } = deps;
  await ensureQueues(boss);

  await registerWorker(boss, {
    mirror,
    logger,
    queue: QUEUES.emailOutbox,
    async handle() {
      let queued = 0;
      try {
        queued = await deps.queueImmediate();
      } catch (error) {
        logger.warn('could not queue at once notices', { err: error });
      }
      const result = await deps.drain();
      const pruned = await deps.prune();
      if (queued > 0 || result.claimed > 0 || pruned > 0) {
        logger.info('email outbox run', { queued, ...result, pruned });
      }
    },
  });

  await registerWorker(boss, {
    mirror,
    logger,
    queue: QUEUES.emailDigest,
    async handle() {
      const result = await deps.digests();
      if (result.queued > 0 || result.skipped > 0)
        logger.info('email summaries built', { ...result });
    },
  });

  await scheduleCrons(boss, MAIL_CRON_SCHEDULES);
}
