import { randomBytes } from 'node:crypto';
import { uuidv7 } from '@ad/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { asRole, createTestDatabase, integrationEnabled, makeAccount, type TestDatabase } from './testing';
import { schema } from './index';

describe.skipIf(!integrationEnabled())('donations and payment events (migration 0049)', () => {
  let t: TestDatabase;
  let adminId: string;
  let editorId: string;
  let viewerId: string;
  beforeAll(async () => {
    t = await createTestDatabase();
    const [a, e, v] = [makeAccount({ role: 'admin' }), makeAccount({ role: 'editor' }), makeAccount({ role: 'viewer' })];
    await t.db.insert(schema.accounts).values([a, e, v]);
    [adminId, editorId, viewerId] = [a.id, e.id, v.id];
  });
  afterAll(async () => {
    await t?.drop();
  });

  const ref = () => `ad-don-${randomBytes(10).toString('hex')}`;
  async function donation(over: { reference?: string; accountId?: string | null; amount?: number; currency?: string; mode?: string; status?: string } = {}) {
    const reference = over.reference ?? ref();
    await t.pool.query(
      `INSERT INTO donations (id, reference, currency, amount_minor, donor_email_enc, donor_email_hash, account_id, site_mode, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::donation_status)`,
      [uuidv7(), reference, over.currency ?? 'NGN', over.amount ?? 250000, Buffer.from('enc'), Buffer.from('hash'), over.accountId ?? null, over.mode ?? 'test', over.status ?? 'pending'],
    );
    return reference;
  }
  const readAs = (role: 'ad_app' | 'ad_worker', actorRole: string | undefined, accountId?: string) =>
    asRole(t.pool, role, { actorRole, accountId }, async (c) => (await c.query('SELECT reference FROM donations')).rows.map((r) => r.reference as string));

  it('keeps amounts positive, currencies known and references unique', async () => {
    await expect(donation({ amount: 0 })).rejects.toThrow();
    await expect(donation({ amount: -5 })).rejects.toThrow();
    await expect(donation({ currency: 'EUR' })).rejects.toThrow();
    await expect(donation({ mode: 'staging' })).rejects.toThrow();
    const r = await donation();
    await expect(donation({ reference: r })).rejects.toThrow();
  });

  it('shows donations to an admin, hides them from an editor and anonymous web callers', async () => {
    const r = await donation();
    expect(await readAs('ad_app', 'admin', adminId)).toContain(r);
    expect(await readAs('ad_app', 'editor', editorId)).toEqual([]);
    expect(await readAs('ad_app', undefined)).toEqual([]);
  });

  it('lets a signed in viewer read only their own donations', async () => {
    const mine = await donation({ accountId: viewerId });
    const other = await donation({ accountId: adminId });
    const seen = await readAs('ad_app', 'viewer', viewerId);
    expect(seen).toContain(mine);
    expect(seen).not.toContain(other);
  });

  it('gives the web role no way to insert or change a donation directly', async () => {
    await expect(
      asRole(t.pool, 'ad_app', { actorRole: 'admin', accountId: adminId }, (c) =>
        c.query(`INSERT INTO donations (id, reference, currency, amount_minor, donor_email_enc, donor_email_hash, site_mode) VALUES ($1, $2, 'NGN', 100, 'x', 'y', 'test')`, [uuidv7(), ref()]),
      ),
    ).rejects.toThrow();
  });

  it('lets the worker read and update donations with no account context', async () => {
    const r = await donation();
    const changed = await asRole(t.pool, 'ad_worker', {}, async (c) =>
      (await c.query("UPDATE donations SET status = 'succeeded', paid_at = now() WHERE reference = $1", [r])).rowCount,
    );
    expect(changed).toBe(1);
    expect(await readAs('ad_worker', undefined)).toContain(r);
  });

  it('stores a webhook event once through the definer function and hides the table from everyone but admins', async () => {
    const insert = (key: string) =>
      asRole(t.pool, 'ad_app', {}, async (c) =>
        (await c.query<{ id: string | null }>("SELECT payment_event_insert('paystack', $1, 'charge.success', $2, $3) AS id", [key, 'ad-don-x', Buffer.from('payload')])).rows[0]!.id,
      );
    const first = await insert('key-1');
    expect(first).not.toBeNull();
    expect(await insert('key-1')).toBeNull();
    expect(await insert('key-2')).not.toBeNull();
    const rows = (actorRole: string | undefined, accountId?: string) =>
      asRole(t.pool, 'ad_app', { actorRole, accountId }, async (c) => (await c.query('SELECT id FROM payment_events')).rows);
    expect(await rows('editor', editorId)).toEqual([]);
    expect(await rows(undefined)).toEqual([]);
    expect((await rows('admin', adminId)).length).toBeGreaterThan(0);
  });

  it('lets the worker read, update and prune payment events', async () => {
    await t.pool.query("SELECT payment_event_insert('paystack', 'key-w', 'charge.success', NULL, 'p'::bytea)");
    const out = await asRole(t.pool, 'ad_worker', {}, async (c) => {
      const row = (await c.query("SELECT id FROM payment_events WHERE event_key = 'key-w'")).rows[0];
      await c.query("UPDATE payment_events SET processed_at = now(), outcome = 'succeeded', payload_enc = NULL WHERE id = $1", [row.id]);
      return (await c.query("SELECT outcome, payload_enc FROM payment_events WHERE event_key = 'key-w'")).rows[0];
    });
    expect(out).toEqual({ outcome: 'succeeded', payload_enc: null });
  });

  it('forces row level security on both tables', async () => {
    const r = await t.pool.query("SELECT relname, relrowsecurity, relforcerowsecurity FROM pg_class WHERE relname IN ('donations', 'payment_events')");
    expect(r.rows.every((x) => x.relrowsecurity && x.relforcerowsecurity)).toBe(true);
    expect(r.rows).toHaveLength(2);
  });
});
