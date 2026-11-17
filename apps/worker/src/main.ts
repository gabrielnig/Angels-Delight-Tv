import { ConfigError, loadWorkerEnv } from '@ad/config';
import { createLogger } from '@ad/shared';
import { bootWorker } from './boot';

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
  const worker = await bootWorker({ env, logger });

  const shutdown = (signal: string) => {
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
