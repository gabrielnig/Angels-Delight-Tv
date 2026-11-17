import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from './schema';

export interface PoolOptions {
  /** Docs/ARCHITECTURE.md section 16: web 10, worker 4. */
  max?: number;
  applicationName?: string;
}

export function createPool(connectionString: string, options: PoolOptions = {}): pg.Pool {
  return new pg.Pool({
    connectionString,
    max: options.max ?? 10,
    application_name: options.applicationName,
  });
}

export function createDb(pool: pg.Pool) {
  return drizzle(pool, { schema });
}

export type Database = ReturnType<typeof createDb>;
export { schema };
