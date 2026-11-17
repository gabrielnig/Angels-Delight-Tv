import { deriveAnalyticsSecret } from '@ad/analytics';
import { loadWebEnv, type WebEnv } from '@ad/config';
import { createDb, createPool, type Database } from '@ad/db';
import { createStorage, storageConfigFromEnv, type StorageAdapter } from '@ad/storage';
import { createLogger, type Logger } from '@ad/shared';
import { createErrorReporter, type ErrorReporter } from '../observability/error-reporter';

export interface Services {
  env: WebEnv;
  pool: ReturnType<typeof createPool>;
  db: Database;
  mediaStorage: StorageAdapter;
  analyticsSecret: Uint8Array;
  logger: Logger;
  reporter: ErrorReporter;
}

let cached: Services | undefined;

/**
 * Process wide singletons for observability and analytics routes: config, one pool (max 10, ARCHITECTURE section 16),
 * the media bucket, the logger and the optional error reporter. Created on first use, so importing a route never
 * needs the environment. Other lanes may share it or keep their own wiring.
 */
export function getServices(): Services {
  if (cached) return cached;
  const env = loadWebEnv();
  const pool = createPool(env.DATABASE_URL, { max: 10, applicationName: 'ad-web' });
  const logger = createLogger({
    level: env.LOG_LEVEL,
    bindings: { service: 'web', release: env.APP_VERSION },
  });
  cached = {
    env,
    pool,
    db: createDb(pool),
    mediaStorage: createStorage(storageConfigFromEnv(env, env.BUCKET_MEDIA, env.MEDIA_URL_SECRET)),
    analyticsSecret: deriveAnalyticsSecret(env.MEDIA_URL_SECRET),
    logger,
    reporter: createErrorReporter({ dsn: env.SENTRY_DSN, release: env.APP_VERSION }),
  };
  return cached;
}
