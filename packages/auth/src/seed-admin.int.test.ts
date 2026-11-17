import { schema } from '@ad/db';
import { integrationEnabled } from '@ad/db/testing';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { KeyService } from './keys';
import { PasswordHasher } from './password';
import { seedFirstAdmin, SeedRefused } from './seed-admin';
import {
  connectAs,
  createAuthTestDatabases,
  TEST_PASSWORD,
  type AuthTestDatabases,
  type RoleDb,
} from './testing';
import { emailHash } from './identifiers';

describe.skipIf(!integrationEnabled())('seedFirstAdmin', () => {
  let dbs: AuthTestDatabases;
  let owner: RoleDb;
  const pepper = new Uint8Array(32).fill(9);
  const kek = new Uint8Array(32).fill(5);

  beforeAll(async () => {
    dbs = await createAuthTestDatabases();
    owner = connectAs(dbs.admin.url, 'ad_migrator');
  });
  afterAll(async () => {
    await owner.pool.end();
    await dbs.drop();
  });

  const deps = () => ({
    db: owner.db,
    keys: new KeyService({ keysDb: dbs.keys.db, kek }),
    hasher: new PasswordHasher({ memoryKib: 8, timeCost: 1, parallelism: 1 }),
    pepper,
  });

  it('creates a verified admin with an encrypted email and a key, running as the owner role', async () => {
    const result = await seedFirstAdmin(deps(), {
      email: ' Vanessa@Example.org ',
      password: TEST_PASSWORD,
    });
    const [row] = await dbs.admin.db
      .select()
      .from(schema.accounts)
      .where(eq(schema.accounts.id, result.accountId));
    expect(row).toMatchObject({ role: 'admin', status: 'active' });
    expect(row?.emailVerifiedAt).not.toBeNull();
    expect(
      Buffer.from(row!.emailHash!).equals(Buffer.from(emailHash('vanessa@example.org', pepper))),
    ).toBe(true);
    expect(row?.passwordHash).toMatch(/^\$argon2id\$/);
    const keys = await dbs.admin.keysPool.query('SELECT 1 FROM user_keys WHERE account_id = $1', [
      result.accountId,
    ]);
    expect(keys.rowCount).toBe(1);
  });

  it('refuses to run when an admin already exists', async () => {
    await expect(
      seedFirstAdmin(deps(), { email: 'second@example.org', password: TEST_PASSWORD }),
    ).rejects.toBeInstanceOf(SeedRefused);
    const rows = await dbs.admin.db
      .select()
      .from(schema.accounts)
      .where(eq(schema.accounts.role, 'admin'));
    expect(rows).toHaveLength(1);
  });

  it('applies the password rules', async () => {
    await expect(
      seedFirstAdmin(deps(), { email: 'x@example.org', password: 'short' }),
    ).rejects.toThrow(/password/i);
  });
});
