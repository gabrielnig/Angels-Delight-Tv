import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import pg from 'pg';
import { createDb, type Database } from '../client';
import { KEYS_MIGRATIONS, MAIN_MIGRATIONS, runMigrations } from '../migrate';

const ROLES_SQL = resolve(import.meta.dirname, '../../sql/roles.sql');

export function integrationEnabled(): boolean {
  return Boolean(process.env.TEST_DATABASE_ADMIN_URL);
}

export interface TestDatabase {
  name: string;
  url: string;
  keysUrl: string;
  pool: pg.Pool;
  db: Database;
  keysPool: pg.Pool;
  drop(): Promise<void>;
}

function withDatabase(adminUrl: string, name: string): string {
  const url = new URL(adminUrl);
  url.pathname = `/${name}`;
  return url.toString();
}

/**
 * Creates a throwaway database owned by ad_migrator, applies every migration as that role (like a real deploy)
 * and returns a superuser pool. Tests switch to a service role with asRole().
 * Needs TEST_DATABASE_ADMIN_URL pointing at a superuser connection, for example postgres://postgres:postgres@localhost:5432/postgres.
 */
export async function createTestDatabase(): Promise<TestDatabase> {
  const adminUrl = process.env.TEST_DATABASE_ADMIN_URL;
  if (!adminUrl) throw new Error('TEST_DATABASE_ADMIN_URL is not set');

  const suffix = randomBytes(5).toString('hex');
  const name = `ad_test_${suffix}`;
  const keysName = `ad_keys_test_${suffix}`;

  const admin = new pg.Pool({ connectionString: adminUrl, max: 1 });
  try {
    await admin.query(readFileSync(ROLES_SQL, 'utf8'));
    await admin.query(`CREATE DATABASE ${name} OWNER ad_migrator`);
    await admin.query(`CREATE DATABASE ${keysName} OWNER ad_migrator`);
  } finally {
    await admin.end();
  }

  const url = withDatabase(adminUrl, name);
  const keysUrl = withDatabase(adminUrl, keysName);
  await runMigrations(url, MAIN_MIGRATIONS, 'ad_migrator');
  await runMigrations(keysUrl, KEYS_MIGRATIONS, 'ad_migrator');

  const pool = new pg.Pool({ connectionString: url, max: 4 });
  const keysPool = new pg.Pool({ connectionString: keysUrl, max: 2 });
  return {
    name,
    url,
    keysUrl,
    pool,
    db: createDb(pool),
    keysPool,
    async drop() {
      await pool.end();
      await keysPool.end();
      const cleanup = new pg.Pool({ connectionString: adminUrl, max: 1 });
      try {
        await cleanup.query(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);
        await cleanup.query(`DROP DATABASE IF EXISTS ${keysName} WITH (FORCE)`);
      } finally {
        await cleanup.end();
      }
    },
  };
}

export type ServiceRole =
  'ad_app' | 'ad_worker' | 'ad_maintenance' | 'ad_migrator' | 'ad_keys_app' | 'ad_keys_shred';

/** Runs `fn` on one connection with the session switched to a service role, so grants and row level security apply. */
export async function asRole<T>(
  pool: pg.Pool,
  role: ServiceRole,
  context: { accountId?: string; actorRole?: string },
  fn: (client: pg.PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`SET LOCAL ROLE ${role}`);
    if (context.accountId)
      await client.query("SELECT set_config('app.account_id', $1, true)", [context.accountId]);
    if (context.actorRole)
      await client.query("SELECT set_config('app.actor_role', $1, true)", [context.actorRole]);
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
