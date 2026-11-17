import { loadMigrateEnv } from '@ad/config';
import { createLogger } from '@ad/shared';
import { KEYS_MIGRATIONS, MAIN_MIGRATIONS, runMigrations } from './migrate';

async function main(): Promise<void> {
  const logger = createLogger({ bindings: { app: 'migrate' } });
  const env = loadMigrateEnv();
  logger.info('applying main migrations');
  await runMigrations(env.DATABASE_URL_MIGRATE, MAIN_MIGRATIONS);
  if (env.KEYS_DATABASE_URL_MIGRATE) {
    logger.info('applying keys migrations');
    await runMigrations(env.KEYS_DATABASE_URL_MIGRATE, KEYS_MIGRATIONS);
  } else {
    logger.warn('KEYS_DATABASE_URL_MIGRATE not set, keys database left untouched');
  }
  logger.info('migrations done');
}

main().catch((error: unknown) => {
  createLogger({ bindings: { app: 'migrate' } }).error('migration failed', { err: error });
  process.exitCode = 1;
});
