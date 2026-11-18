import {
  EXPORT_CRON_SCHEDULES,
  QUEUES,
  ensureQueues,
  registerWorker,
  scheduleCrons,
  type BossLike,
  type JobMirror,
} from '@ad/queue';
import type { Logger } from '@ad/shared';

export interface ExportDeps {
  generate(
    exportId: string,
    options: { finalAttempt: boolean },
  ): Promise<'built' | 'skipped' | 'failed'>;
  cleanup(): Promise<number>;
  mirror: JobMirror;
  logger: Logger;
}

/** The export jobs (M19-S05, M20-S03). Builds are queued by the web app; only the cleanup runs on a schedule. */
export async function registerExportHandlers(boss: BossLike, deps: ExportDeps): Promise<void> {
  const { mirror, logger } = deps;
  await ensureQueues(boss);

  await registerWorker(boss, {
    mirror,
    logger,
    queue: QUEUES.exportsGenerate,
    async handle(payload, context) {
      const result = await deps.generate(payload.exportId, {
        finalAttempt: context.isLastAttempt,
      });
      logger.info('export finished', { exportId: payload.exportId, result });
    },
  });

  await registerWorker(boss, {
    mirror,
    logger,
    queue: QUEUES.exportsCleanup,
    async handle() {
      const removed = await deps.cleanup();
      if (removed > 0) logger.info('expired exports removed', { removed });
    },
  });

  await scheduleCrons(boss, EXPORT_CRON_SCHEDULES);
}
