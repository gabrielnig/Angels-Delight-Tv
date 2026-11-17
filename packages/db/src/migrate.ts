import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { resolve } from 'node:path';
import pg from 'pg';

export const MAIN_MIGRATIONS = resolve(import.meta.dirname, '../migrations/main');
export const KEYS_MIGRATIONS = resolve(import.meta.dirname, '../migrations/keys');

/** Applies every pending migration in `folder`. Run with the owner role, never the app role. */
export async function runMigrations(
  connectionString: string,
  folder: string,
  role?: string,
): Promise<void> {
  const pool = new pg.Pool({
    connectionString,
    max: 1,
    options: role ? `-c role=${role}` : undefined,
  });
  try {
    await migrate(drizzle(pool), { migrationsFolder: folder });
  } finally {
    await pool.end();
  }
}
