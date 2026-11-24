import { ConfigError, loadWorkerEnv } from '@ad/config';
import { createLogger } from '@ad/shared';
import { DrizzleHeartbeatStore, buildViewerDigests, startHeartbeat } from '@ad/queue';
import type { PgBoss } from 'pg-boss';
import { bootWorker } from './boot';
import { registerVideoHandlers } from './handlers';
import { refreshTrending } from '@ad/analytics';
import { rollupRatings } from './engage';
import { registerEngageHandlers } from './engage-handlers';
import { fanoutNotices, pruneNotices } from './notices';
import { registerExportHandlers } from './export-handlers';
import { registerTranslateHandlers } from './translate-handlers';
import { registerMailHandlers } from './mail';
import { registerMaintenanceHandlers } from './maintenance';
import { buildMonetizationDeps } from './monetization';
import { registerMonetizationHandlers } from './monetization-handlers';
import { registerPreviewHandlers } from './preview-handlers';
import {
  buildExportDeps,
  buildTranslateDeps,
  buildMailDeps,
  buildMaintenanceDeps,
  buildVideoHandlerDeps,
  createWorkerDb,
} from './runtime';

async function main(): Promise<void> {
  const bootLogger = createLogger({ bindings: { app: 'worker' } });
  let env;
  try {
    env = loadWorkerEnv();
  } catch (error) {
    if (error instanceof ConfigError) {
      bootLogger.error('invalid configuration', { issues: error.issues });
      process.exitCode = 1;
      return;
    }
    throw error;
  }

  const logger = createLogger({ level: env.LOG_LEVEL, bindings: { app: 'worker' } });
  const worker = await bootWorker({
    env,
    logger,
    register: async (queueBoss, raw) => {
      const db = createWorkerDb(env);
      const video = buildVideoHandlerDeps(env, raw as unknown as PgBoss, logger, db);
      await registerVideoHandlers(queueBoss, video);
      await registerMaintenanceHandlers(queueBoss, {
        ...buildMaintenanceDeps(env, db, logger),
        mirror: video.mirror,
        logger,
      });
      await registerPreviewHandlers(queueBoss, {
        pipeline: video.pipeline,
        mirror: video.mirror,
        logger,
      });
      await registerExportHandlers(queueBoss, {
        ...buildExportDeps(env, db, logger),
        mirror: video.mirror,
        logger,
      });
      await registerTranslateHandlers(queueBoss, buildTranslateDeps(env, db, logger, video.mirror));
      await registerEngageHandlers(queueBoss, {
        rollupRatings: () => rollupRatings(db),
        refreshTrending: () => refreshTrending(db, new Date()),
        fanoutNotices: () => fanoutNotices(db, new Date()),
        pruneNotices: () => pruneNotices(db, new Date()),
        buildViewerDigests: () => buildViewerDigests({ db, kek: env.FIELD_KEK }),
        mirror: video.mirror,
        logger,
      });
      await registerMonetizationHandlers(queueBoss, {
        ...buildMonetizationDeps(env, db, queueBoss, logger),
        mirror: video.mirror,
        logger,
      });
      await registerMailHandlers(queueBoss, {
        ...buildMailDeps(env, db),
        mirror: video.mirror,
        logger,
      });
    },
  });

  // The uptime monitor alerts when this stops for 5 minutes (M24-S02 AC2).
  const heartbeatStore = new DrizzleHeartbeatStore(createWorkerDb(env));
  const heartbeat = startHeartbeat({
    beat: () => heartbeatStore.beat('worker'),
    onError: (error) => logger.warn('heartbeat write failed', { err: error }),
  });

  const shutdown = (signal: string) => {
    heartbeat.stop();
    logger.info('shutdown requested', { signal });
    worker.stop().then(
      () => process.exit(0),
      (error: unknown) => {
        logger.error('shutdown failed', { err: error });
        process.exit(1);
      },
    );
  };
  process.once('SIGTERM', () => shutdown('SIGTERM'));
  process.once('SIGINT', () => shutdown('SIGINT'));
}

main().catch((error: unknown) => {
  createLogger({ bindings: { app: 'worker' } }).error('worker failed to start', { err: error });
  process.exit(1);
});
