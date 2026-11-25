import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { accounts } from './schema';
import {
  asRole,
  createTestDatabase,
  integrationEnabled,
  makeAccount,
  type TestDatabase,
} from './testing';

describe.skipIf(!integrationEnabled())('help_progress (M50-S25, S26)', () => {
  let t: TestDatabase;
  let a: ReturnType<typeof makeAccount>;
  let b: ReturnType<typeof makeAccount>;

  beforeAll(async () => {
    t = await createTestDatabase();
    a = makeAccount();
    b = makeAccount();
    await t.db.insert(accounts).values([a, b]);
  });
  afterAll(async () => {
    await t?.drop();
  });

  const save = (accountId: string, article: string, set = 'guide_done_at = now()') =>
    asRole(t.pool, 'ad_app', { accountId }, (c) =>
      c.query(
        `INSERT INTO help_progress (account_id, article_id) VALUES ($1, $2)
         ON CONFLICT (account_id, article_id) DO UPDATE SET ${set}, updated_at = now()`,
        [accountId, article],
      ),
    );

  it('an account saves, reads and deletes only its own rows', async () => {
    await save(a.id, 'D02');
    await save(b.id, 'D02');
    const own = await asRole(t.pool, 'ad_app', { accountId: a.id }, (c) =>
      c.query('SELECT account_id FROM help_progress'),
    );
    expect(own.rows.map((r) => r.account_id)).toEqual([a.id]);
    const none = await asRole(t.pool, 'ad_app', {}, (c) => c.query('SELECT 1 FROM help_progress'));
    expect(none.rowCount).toBe(0);
    const del = await asRole(t.pool, 'ad_app', { accountId: a.id }, (c) =>
      c.query('DELETE FROM help_progress'),
    );
    expect(del.rowCount).toBe(1);
  });

  it('refuses writing a row for another account', async () => {
    await expect(
      asRole(t.pool, 'ad_app', { accountId: a.id }, (c) =>
        c.query('INSERT INTO help_progress (account_id, article_id) VALUES ($1, $2)', [
          b.id,
          'D03',
        ]),
      ),
    ).rejects.toThrow(/row-level security/i);
  });

  it('checks the article id shape and keeps one row per account and guide', async () => {
    await expect(save(a.id, 'nonsense')).rejects.toThrow(/check/i);
    await save(a.id, 'D05');
    await save(a.id, 'D05', 'helpful = true');
    const rows = await asRole(t.pool, 'ad_app', { accountId: a.id }, (c) =>
      c.query("SELECT helpful, guide_done_at FROM help_progress WHERE article_id = 'D05'"),
    );
    expect(rows.rowCount).toBe(1);
    expect(rows.rows[0].helpful).toBe(true);
  });

  it('is removed with the account', async () => {
    await save(b.id, 'D09');
    await t.pool.query('DELETE FROM accounts WHERE id = $1', [b.id]);
    const left = await t.pool.query('SELECT 1 FROM help_progress WHERE account_id = $1', [b.id]);
    expect(left.rowCount).toBe(0);
  });
});
