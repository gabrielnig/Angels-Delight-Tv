import { eq, sql } from 'drizzle-orm';
import { randomBytes } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { accounts, staffNotificationPrefs } from './schema';
import {
  asRole,
  createTestDatabase,
  integrationEnabled,
  makeAccount,
  type TestDatabase,
} from './testing';

describe.skipIf(!integrationEnabled())('email outbox support (migration 0032)', () => {
  let t: TestDatabase;
  beforeAll(async () => {
    t = await createTestDatabase();
  });
  afterAll(async () => {
    await t?.drop();
  });

  const idsAs = (role: 'ad_worker' | 'ad_app') =>
    asRole(t.pool, role, {}, async (client) =>
      (await client.query<{ id: string }>('SELECT * FROM active_staff_ids() AS s(id)')).rows
        .map((r) => r.id)
        .sort(),
    );

  it('lists active editors, admins and Super admins and nobody else, without opening accounts to the worker', async () => {
    const wanted: string[] = [];
    for (const [role, status] of [
      ['editor', 'active'],
      ['admin', 'active'],
      ['super_admin', 'active'],
      ['editor', 'suspended'],
      ['viewer', 'active'],
    ] as const) {
      const row = makeAccount({ role, status });
      await t.db.insert(accounts).values(row);
      if (status === 'active' && role !== 'viewer') wanted.push(row.id);
    }
    expect(await idsAs('ad_worker')).toEqual(wanted.sort());
    expect(await idsAs('ad_app')).toEqual(wanted.sort());
    await expect(
      asRole(t.pool, 'ad_worker', {}, (client) => client.query('SELECT id FROM accounts')),
    ).rejects.toThrow(/permission denied/);
  });

  it('forgets the saved staff address when the account email changes, so mail never goes to an old address', async () => {
    const row = makeAccount({ role: 'editor', status: 'active' });
    await t.db.insert(accounts).values(row);
    await t.db.insert(staffNotificationPrefs).values({
      accountId: row.id,
      emailFrequency: 'daily',
      addressEnc: randomBytes(40),
    });
    await t.db
      .update(accounts)
      .set({ displayNameEnc: randomBytes(30) })
      .where(eq(accounts.id, row.id));
    const [kept] = await t.db
      .select()
      .from(staffNotificationPrefs)
      .where(eq(staffNotificationPrefs.accountId, row.id));
    expect(kept?.addressEnc).not.toBeNull();

    await t.db
      .update(accounts)
      .set({ emailEnc: randomBytes(48) })
      .where(eq(accounts.id, row.id));
    const [cleared] = await t.db
      .select()
      .from(staffNotificationPrefs)
      .where(eq(staffNotificationPrefs.accountId, row.id));
    expect(cleared?.addressEnc).toBeNull();
    expect(cleared?.emailFrequency).toBe('daily');
  });

  it('removes the saved address with the account', async () => {
    const row = makeAccount({ role: 'admin', status: 'active' });
    await t.db.insert(accounts).values(row);
    await t.db
      .insert(staffNotificationPrefs)
      .values({ accountId: row.id, addressEnc: randomBytes(40) });
    await t.db.execute(sql`DELETE FROM accounts WHERE id = ${row.id}`);
    const left = await t.db
      .select()
      .from(staffNotificationPrefs)
      .where(eq(staffNotificationPrefs.accountId, row.id));
    expect(left).toHaveLength(0);
  });

  it('keeps outbox rows readable only by the app and the worker', async () => {
    await expect(
      asRole(t.pool, 'ad_maintenance', {}, (client) => client.query('SELECT id FROM email_outbox')),
    ).rejects.toThrow(/permission denied/);
    await asRole(t.pool, 'ad_worker', {}, (client) => client.query('SELECT id FROM email_outbox'));
    await asRole(t.pool, 'ad_app', {}, (client) => client.query('SELECT id FROM email_outbox'));
  });
});
