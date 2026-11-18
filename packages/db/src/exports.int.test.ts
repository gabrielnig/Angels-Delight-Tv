import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { accounts, staffExports } from './schema';
import {
  asRole,
  createTestDatabase,
  integrationEnabled,
  makeAccount,
  type TestDatabase,
} from './testing';

describe.skipIf(!integrationEnabled())('staff exports table (migration 0033)', () => {
  let t: TestDatabase;
  let one: string;
  let two: string;
  beforeAll(async () => {
    t = await createTestDatabase();
    const a = makeAccount({ role: 'super_admin', status: 'active' });
    const b = makeAccount({ role: 'super_admin', status: 'active' });
    await t.db.insert(accounts).values([a, b]);
    one = a.id;
    two = b.id;
    await t.db.insert(staffExports).values([
      { requesterId: one, kind: 'audit' },
      { requesterId: two, kind: 'analytics', params: { from: '2026-01-01', to: '2026-01-31' } },
    ]);
  });
  afterAll(async () => {
    await t?.drop();
  });

  const idsFor = (accountId: string) =>
    asRole(t.pool, 'ad_app', { accountId, actorRole: 'super_admin' }, async (client) =>
      (
        await client.query<{ requester_id: string }>('SELECT requester_id FROM staff_exports')
      ).rows.map((r) => r.requester_id),
    );

  it('shows the app role only the rows of the person asking, even when the query does not filter', async () => {
    expect(await idsFor(one)).toEqual([one]);
    expect(await idsFor(two)).toEqual([two]);
  });

  it('shows the app role nothing when nobody is signed in', async () => {
    const rows = await asRole(
      t.pool,
      'ad_app',
      {},
      async (client) => (await client.query('SELECT id FROM staff_exports')).rows,
    );
    expect(rows).toEqual([]);
  });

  it('refuses a row written for someone else', async () => {
    await expect(
      asRole(t.pool, 'ad_app', { accountId: one, actorRole: 'super_admin' }, (client) =>
        client.query("INSERT INTO staff_exports (requester_id, kind) VALUES ($1, 'audit')", [two]),
      ),
    ).rejects.toThrow(/row-level security/);
  });

  it('does not let the app delete rows, only the worker cleans up', async () => {
    await expect(
      asRole(t.pool, 'ad_app', { accountId: one, actorRole: 'super_admin' }, (client) =>
        client.query('DELETE FROM staff_exports'),
      ),
    ).rejects.toThrow(/permission denied/);
  });

  it('lets the worker see every export and read the audit log', async () => {
    const rows = await asRole(t.pool, 'ad_worker', {}, async (client) => {
      await client.query('SELECT count(*) FROM audit_log');
      return (await client.query('SELECT id FROM staff_exports')).rows;
    });
    expect(rows).toHaveLength(2);
  });

  it('refuses a kind, scope or status it does not know', async () => {
    for (const bad of [
      { kind: 'everything' },
      { kind: 'audit', scope: 'secret' },
      { kind: 'audit', status: 'done' },
    ]) {
      await expect(
        t.db.insert(staffExports).values({ requesterId: one, ...bad }),
      ).rejects.toThrow();
    }
  });

  it('goes with the account', async () => {
    const c = makeAccount({ role: 'super_admin', status: 'active' });
    await t.db.insert(accounts).values(c);
    await t.db.insert(staffExports).values({ requesterId: c.id, kind: 'audit' });
    await t.pool.query('DELETE FROM accounts WHERE id = $1', [c.id]);
    const left = await t.pool.query('SELECT id FROM staff_exports WHERE requester_id = $1', [c.id]);
    expect(left.rows).toHaveLength(0);
  });
});
