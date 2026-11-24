import {
  ENGAGE_CRON_SCHEDULES,
  QUEUES,
  ensureQueues,
  registerWorker,
  scheduleCrons,
  type BossLike,
  type JobMirror,
} from '@ad/queue';
import type { Logger } from '@ad/shared';

export interface EngageDeps {
  rollupRatings(): Promise<{ titles: number; labelled: number }>;
  mirror: JobMirror;
  logger: Logger;
}

/** The engagement jobs (L5, M44). Every job is idempotent, so a retry or a double run changes nothing. */
export async function registerEngageHandlers(boss: BossLike, deps: EngageDeps): Promise<void> {
  const { mirror, logger } = deps;
  await ensureQueues(boss);

  await registerWorker(boss, {
    mirror,
    logger,
    queue: QUEUES.ratingsRollup,
    async handle() {
      const result = await deps.rollupRatings();
      logger.info('ratings rolled up', result);
    },
  });

  await scheduleCrons(boss, ENGAGE_CRON_SCHEDULES);
}
