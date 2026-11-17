import { createDb, type Database } from '@ad/db';
import { createTestDatabase, type TestDatabase } from '@ad/db/testing';
import pg from 'pg';

/** Test helpers. Opens connections that run as a service role so grants and row level security really apply. */
export interface RoleDb {
  db: Database;
  pool: pg.Pool;
}

export function connectAs(url: string, role: string): RoleDb {
  const pool = new pg.Pool({ connectionString: url, max: 4, options: `-c role=${role}` });
  return { db: createDb(pool), pool };
}

export interface AuthTestDatabases {
  admin: TestDatabase;
  app: RoleDb;
  keys: RoleDb;
  shred: RoleDb;
  drop(): Promise<void>;
}

export async function createAuthTestDatabases(): Promise<AuthTestDatabases> {
  const admin = await createTestDatabase();
  const app = connectAs(admin.url, 'ad_app');
  const keys = connectAs(admin.keysUrl, 'ad_keys_app');
  const shred = connectAs(admin.keysUrl, 'ad_keys_shred');
  return {
    admin,
    app,
    keys,
    shred,
    async drop() {
      await Promise.all([app.pool.end(), keys.pool.end(), shred.pool.end()]);
      await admin.drop();
    },
  };
}
