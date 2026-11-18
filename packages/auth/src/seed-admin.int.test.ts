import { schema, withAccount } from '@ad/db';
import { integrationEnabled } from '@ad/db/testing';
import { eq } from 'drizzle-orm';
import { uuidv7 } from '@ad/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { KeyService } from './keys';
import { PasswordHasher } from './password';
import { promoteToSuperAdmin, seedFirstAdmin, SeedRefused } from './seed-admin';
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

  async function insertAccount(
    d: ReturnType<typeof deps>,
    id: string,
    email: string,
    role: 'admin' | 'editor',
  ) {
    const emailEnc = await d.keys.seal(id, 'email', email);
    await withAccount(d.db, { accountId: id, role: 'viewer' }, (tx) =>
      tx.insert(schema.accounts).values({
        id,
        emailHash: Buffer.from(emailHash(email, pepper)),
        emailEnc,
        passwordHash: 'x',
        role,
        emailVerifiedAt: new Date(),
      }),
    );
  }

  const deps = () => ({
    db: owner.db,
    keys: new KeyService({ keysDb: dbs.keys.db, kek }),
    hasher: new PasswordHasher({ memoryKib: 8, timeCost: 1, parallelism: 1 }),
    pepper,
  });

  it('creates a verified Super admin with an encrypted email and a key, running as the owner role', async () => {
    const result = await seedFirstAdmin(deps(), {
      email: ' Vanessa@Example.org ',
      password: TEST_PASSWORD,
    });
    const [row] = await dbs.admin.db
      .select()
      .from(schema.accounts)
      .where(eq(schema.accounts.id, result.accountId));
    expect(row).toMatchObject({ role: 'super_admin', status: 'active' });
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

  it('refuses to run when a Super admin already exists', async () => {
    await expect(
      seedFirstAdmin(deps(), { email: 'second@example.org', password: TEST_PASSWORD }),
    ).rejects.toBeInstanceOf(SeedRefused);
    const rows = await dbs.admin.db
      .select()
      .from(schema.accounts)
      .where(eq(schema.accounts.role, 'super_admin'));
    expect(rows).toHaveLength(1);
  });

  it('refuses to seed when only plain admins exist and points at the promote command', async () => {
    const other = await createAuthTestDatabases();
    const db = connectAs(other.admin.url, 'ad_migrator');
    try {
      const d = { ...deps(), db: db.db, keys: new KeyService({ keysDb: other.keys.db, kek }) };
      const id = uuidv7();
      await d.keys.createForAccount(id);
      await insertAccount(d, id, 'legacy@example.org', 'admin');
      await expect(
        seedFirstAdmin(d, { email: 'new@example.org', password: TEST_PASSWORD }),
      ).rejects.toThrow(/promote/i);
    } finally {
      await db.pool.end();
      await other.drop();
    }
  });

  describe('promoteToSuperAdmin (installs that had admins before D-128)', () => {
    it('promotes a named active admin when no Super admin exists, and nobody else', async () => {
      const other = await createAuthTestDatabases();
      const db = connectAs(other.admin.url, 'ad_migrator');
      try {
        const d = { ...deps(), db: db.db, keys: new KeyService({ keysDb: other.keys.db, kek }) };
        const id1 = uuidv7();
        const id2 = uuidv7();
        for (const [id, email] of [
          [id1, 'old1@example.org'],
          [id2, 'old2@example.org'],
        ] as const) {
          await d.keys.createForAccount(id);
          await insertAccount(d, id, email, 'admin');
        }
        await promoteToSuperAdmin(d, { email: ' OLD1@example.org ' });
        const rows = await d.db.select().from(schema.accounts);
        expect(rows.find((r) => r.id === id1)?.role).toBe('super_admin');
        expect(rows.find((r) => r.id === id2)?.role).toBe('admin');
        await expect(promoteToSuperAdmin(d, { email: 'old2@example.org' })).rejects.toBeInstanceOf(
          SeedRefused,
        );
      } finally {
        await db.pool.end();
        await other.drop();
      }
    });

    it('refuses an unknown address, a viewer and an editor', async () => {
      const other = await createAuthTestDatabases();
      const db = connectAs(other.admin.url, 'ad_migrator');
      try {
        const d = { ...deps(), db: db.db, keys: new KeyService({ keysDb: other.keys.db, kek }) };
        const id = uuidv7();
        await d.keys.createForAccount(id);
        await insertAccount(d, id, 'ed@example.org', 'editor');
        await expect(
          promoteToSuperAdmin(d, { email: 'nobody@example.org' }),
        ).rejects.toBeInstanceOf(SeedRefused);
        await expect(promoteToSuperAdmin(d, { email: 'ed@example.org' })).rejects.toBeInstanceOf(
          SeedRefused,
        );
      } finally {
        await db.pool.end();
        await other.drop();
      }
    });
  });

  it('applies the password rules', async () => {
    await expect(
      seedFirstAdmin(deps(), { email: 'x@example.org', password: 'short' }),
    ).rejects.toThrow(/password/i);
  });
});
