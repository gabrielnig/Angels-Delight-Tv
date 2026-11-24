import {
  MONETIZATION_CRON_SCHEDULES,
  QUEUES,
  ensureQueues,
  registerWorker,
  scheduleCrons,
  type BossLike,
  type JobContext,
  type JobMirror,
} from '@ad/queue';
import type { Logger } from '@ad/shared';

export interface MonetizationDeps {
  /** Left out when no Paystack key is set: the donation jobs are then not registered at all. */
  processEvent?(eventId: number, job: Pick<JobContext, 'attempt' | 'isLastAttempt'>): Promise<unknown>;
  reconcile?(): Promise<Record<string, number>>;
  pruneEvents?(): Promise<number>;
  /** Deletes the daily reach hashes older than two days. Always on, sponsors need it with no payments. */
  pruneReach(): Promise<number>;
  mirror: JobMirror;
  logger: Logger;
}

/** The sponsor and donation jobs (L9, M48). Every job is idempotent, so a retry or a double run changes nothing. */
export async function registerMonetizationHandlers(boss: BossLike, deps: MonetizationDeps): Promise<void> {
  const { mirror, logger } = deps;
  await ensureQueues(boss);
  const queues: string[] = [QUEUES.sponsorsReachPrune];

  await registerWorker(boss, {
    mirror,
    logger,
    queue: QUEUES.sponsorsReachPrune,
    async handle() {
      logger.info('sponsor reach rows pruned', { deleted: await deps.pruneReach() });
    },
  });

  const { processEvent, reconcile, pruneEvents } = deps;
  if (processEvent && reconcile && pruneEvents) {
    queues.push(QUEUES.donationsProcessEvent, QUEUES.donationsReconcile, QUEUES.donationsPruneEvents);
    await registerWorker(boss, {
      mirror,
      logger,
      queue: QUEUES.donationsProcessEvent,
      async handle(payload, job) {
        const outcome = await processEvent(payload.eventId, job);
        // The outcome is a short word. The event body and donor details are never logged.
        logger.info('donation event processed', { outcome });
      },
    });
    await registerWorker(boss, {
      mirror,
      logger,
      queue: QUEUES.donationsReconcile,
      async handle() {
        logger.info('donations reconciled', await reconcile());
      },
    });
    await registerWorker(boss, {
      mirror,
      logger,
      queue: QUEUES.donationsPruneEvents,
      async handle() {
        logger.info('payment event payloads pruned', { emptied: await pruneEvents() });
      },
    });
  }

  await scheduleCrons(
    boss,
    MONETIZATION_CRON_SCHEDULES.filter((entry) => queues.includes(entry.queue)),
  );
}
