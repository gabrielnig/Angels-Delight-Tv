import { loadWebEnv, type WebEnv } from '@ad/config';
import { createDb, createPool, type Database } from '@ad/db';
import { createStorage, storageConfigFromEnv, type StorageAdapter } from '@ad/storage';

export interface ToolsRuntime {
  env: WebEnv;
  db: Database;
  originals: StorageAdapter;
  media: StorageAdapter;
  close(): Promise<void>;
}

/**
 * The same wiring the web process uses (app database role, both buckets), for command line tools that run in the
 * `tools` container with the production `.env`. Needs the full web environment.
 */
export function createToolsRuntime(applicationName: string): ToolsRuntime {
  const env = loadWebEnv();
  const pool = createPool(env.DATABASE_URL, { max: 4, applicationName });
  const db = createDb(pool);
  return {
    env,
    db,
    originals: createStorage(storageConfigFromEnv(env, env.BUCKET_ORIGINALS, env.MEDIA_URL_SECRET)),
    media: createStorage(storageConfigFromEnv(env, env.BUCKET_MEDIA, env.MEDIA_URL_SECRET)),
    close: () => pool.end(),
  };
}
