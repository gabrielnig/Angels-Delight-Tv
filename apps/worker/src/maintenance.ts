import {
  QUEUES,
  MAINTENANCE_CRON_SCHEDULES,
  ensureQueues,
  registerWorker,
  scheduleCrons,
  type BossLike,
  type JobMirror,
} from '@ad/queue';
import type { Logger } from '@ad/shared';

export interface MaintenanceDeps {
  /** Rebuilds yesterday and the day before into the daily stats tables. */
  rollup(): Promise<unknown>;
  /** Deletes raw view events past retention. Needs the ad_maintenance connection, so it can be absent. */
  pruneViewEvents?(): Promise<unknown>;
  /** Deletes audit entries past retention. Same connection, so also optional. */
  pruneAudit?(): Promise<unknown>;
  mirror: JobMirror;
  logger: Logger;
}

/**
 * Registers the lane I jobs that were left unscheduled: the nightly analytics rollup and the two monthly prunes.
 * The prunes only exist when `DATABASE_URL_MAINTENANCE` is set, because only `ad_maintenance` may delete from
 * `view_events` and `audit_log`. Without it they are neither registered nor scheduled, and one warning says why.
 */
export async function registerMaintenanceHandlers(
  boss: BossLike,
  deps: MaintenanceDeps,
): Promise<void> {
  const { mirror, logger } = deps;
  await ensureQueues(boss);
  const base = { mirror, logger };
  const scheduled: typeof MAINTENANCE_CRON_SCHEDULES = [];
  const entry = (queue: string) => MAINTENANCE_CRON_SCHEDULES.find((e) => e.queue === queue)!;

  await registerWorker(boss, {
    ...base,
    queue: QUEUES.analyticsRollup,
    async handle() {
      const days = await deps.rollup();
      logger.info('analytics rollup finished', { days });
    },
  });
  scheduled.push(entry(QUEUES.analyticsRollup));

  const { pruneViewEvents, pruneAudit } = deps;
  if (pruneViewEvents) {
    await registerWorker(boss, {
      ...base,
      queue: QUEUES.analyticsPrune,
      async handle() {
        await pruneViewEvents();
      },
    });
    scheduled.push(entry(QUEUES.analyticsPrune));
  }
  if (pruneAudit) {
    await registerWorker(boss, {
      ...base,
      queue: QUEUES.auditPrune,
      async handle() {
        const result = await pruneAudit();
        logger.info('audit prune finished', { result });
      },
    });
    scheduled.push(entry(QUEUES.auditPrune));
  }
  if (!pruneViewEvents || !pruneAudit) {
    logger.warn('retention prunes are not scheduled because DATABASE_URL_MAINTENANCE is not set');
  }

  await scheduleCrons(boss, scheduled);
}
