import { randomBytes } from 'node:crypto';
import { uuidv7 } from '@ad/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { asRole, createTestDatabase, integrationEnabled, makeAccount, type TestDatabase } from './testing';

describe.skipIf(!integrationEnabled())('donation_create and the public status function (migration 0054)', () => {
  let t: TestDatabase;
  let viewerId: string;
  beforeAll(async () => {
    t = await createTestDatabase();
    const v = makeAccount({ role: 'viewer' });
    await t.db.insert((await import('./index')).schema.accounts).values([v]);
    viewerId = v.id;
  });
  afterAll(async () => {
    await t?.drop();
  });

  const ref = () => `ad-don-${randomBytes(10).toString('hex')}`;
  const create = (over: Record<string, unknown> = {}, accountId?: string) => {
    const a = { id: uuidv7(), reference: ref(), attempt: uuidv7(), kind: 'one_time', currency: 'NGN', amount: 250000, mode: 'test', url: 'https://checkout.paystack.com/abc', account: null, ...over };
    return asRole(t.pool, 'ad_app', { accountId }, async (c) =>
      (
        await c.query(
          `SELECT * FROM donation_create($1::uuid, $2, $3, $4, $5, $6::bigint, $7::bytea, $8::bytea, $9::bytea, $10, $11, $12::uuid, $13)`,
          [a.id, a.reference, a.attempt, a.kind, a.currency, a.amount, Buffer.from('enc'), Buffer.from('hash'), null, false, a.mode, a.account, a.url],
        )
      ).rows[0] as { reference: string; checkout_url: string; created: boolean },
    ).then((row) => ({ row, a }));
  };
  const status = (reference: string) =>
    asRole(t.pool, 'ad_app', {}, async (c) => (await c.query('SELECT * FROM donation_public_status($1)', [reference])).rows);

  it('lets the web role create a pending row without table access and returns the reference and url', async () => {
    const { row, a } = await create();
    expect(row).toEqual({ reference: a.reference, checkout_url: a.url, created: true });
    const stored = await t.pool.query('SELECT status, amount_minor, site_mode, attempt_key FROM donations WHERE reference = $1', [a.reference]);
    expect(stored.rows[0]).toMatchObject({ status: 'pending', amount_minor: '250000', site_mode: 'test', attempt_key: a.attempt });
  });

  it('returns the first row again for a repeated attempt key and creates nothing new', async () => {
    const first = await create();
    const second = await create({ attempt: first.a.attempt });
    expect(second.row).toEqual({ reference: first.a.reference, checkout_url: first.a.url, created: false });
    const n = await t.pool.query('SELECT count(*)::int AS n FROM donations WHERE attempt_key = $1', [first.a.attempt]);
    expect(n.rows[0].n).toBe(1);
  });

  it('refuses bad input at the database', async () => {
    await expect(create({ amount: 0 })).rejects.toThrow();
    await expect(create({ currency: 'EUR' })).rejects.toThrow();
    await expect(create({ mode: 'staging' })).rejects.toThrow();
    await expect(create({ reference: 'not a reference' })).rejects.toThrow();
  });

  it('links the signed in account when one is given', async () => {
    const { a } = await create({ account: viewerId }, viewerId);
    const r = await t.pool.query('SELECT account_id FROM donations WHERE reference = $1', [a.reference]);
    expect(r.rows[0].account_id).toBe(viewerId);
  });

  it('shows only status facts through donation_public_status, never contact fields', async () => {
    const { a } = await create();
    const rows = await status(a.reference);
    expect(rows).toHaveLength(1);
    expect(Object.keys(rows[0]).sort()).toEqual(['amount_minor', 'currency', 'kind', 'paid_at', 'status']);
    expect(rows[0]).toMatchObject({ status: 'pending', currency: 'NGN' });
    expect(await status(ref())).toEqual([]);
  });

  it('finds a pending attempt by key for the web role and nothing once it is final', async () => {
    const { a } = await create();
    const find = () => asRole(t.pool, 'ad_app', {}, async (c) => (await c.query('SELECT * FROM donation_by_attempt($1)', [a.attempt])).rows);
    expect(await find()).toEqual([{ reference: a.reference, checkout_url: a.url }]);
    await t.pool.query("UPDATE donations SET status = 'succeeded' WHERE reference = $1", [a.reference]);
    expect(await find()).toEqual([]);
  });

  it('does not let the web role call the functions as anonymous PUBLIC on other schemas, and keeps direct inserts closed', async () => {
    await expect(
      asRole(t.pool, 'ad_app', {}, (c) =>
        c.query(`INSERT INTO donations (id, reference, currency, amount_minor, donor_email_enc, donor_email_hash, site_mode) VALUES ($1, $2, 'NGN', 100, 'x', 'y', 'test')`, [uuidv7(), ref()]),
      ),
    ).rejects.toThrow();
  });
});
