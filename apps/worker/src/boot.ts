import type { Logger } from '@ad/shared';
import { PgBoss, type ConstructorOptions } from 'pg-boss';

/** The slice of PgBoss the worker boot uses, so it can be tested with a fake. */
export interface BossLike {
  on(event: 'error', listener: (error: Error) => void): unknown;
  start(): Promise<unknown>;
  stop(options?: { graceful?: boolean; timeout?: number }): Promise<void>;
}

export interface BootDeps {
  env: { DATABASE_URL_WORKER: string; NODE_ENV: string };
  logger: Logger;
  createBoss?: (options: ConstructorOptions) => BossLike;
}

const POOL_SIZE = 4;
const STOP_TIMEOUT_MS = 30_000;

export async function bootWorker({
  env,
  logger,
  createBoss,
}: BootDeps): Promise<{ stop(): Promise<void> }> {
  const make: (options: ConstructorOptions) => BossLike =
    createBoss ?? ((options) => new PgBoss(options));
  const boss = make({
    connectionString: env.DATABASE_URL_WORKER,
    max: POOL_SIZE,
    application_name: 'ad-worker',
    schema: 'pgboss',
    // The migrations create the schema and grant it. ad_worker has no CREATE on the database itself.
    createSchema: false,
  });

  boss.on('error', (error) => logger.error('queue error', { err: error }));
  await boss.start();
  logger.info('worker ready', { nodeEnv: env.NODE_ENV, poolSize: POOL_SIZE });

  return {
    async stop() {
      await boss.stop({ graceful: true, timeout: STOP_TIMEOUT_MS });
      logger.info('worker stopped');
    },
  };
}
