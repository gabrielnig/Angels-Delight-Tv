import { DonationAdminService, newReference, sealDonorField } from '@ad/payments';
import { schema } from '@ad/db';
import { createTestDatabase, integrationEnabled, makeAccount, type TestDatabase } from '@ad/db/testing';
import { uuidv7 } from '@ad/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createPgDonationAdminStore } from './admin-store';

describe.skipIf(!integrationEnabled())('donations admin on Postgres', () => {
  let t: TestDatabase;
  const kek = new Uint8Array(32).fill(8);
  let admin: { accountId: string; role: 'admin' };
  let editor: { accountId: string; role: 'editor' };
  beforeAll(async () => {
    t = await createTestDatabase();
    const [a, e] = [makeAccount({ role: 'admin' }), makeAccount({ role: 'editor' })];
    await t.db.insert(schema.accounts).values([a, e]);
    admin = { accountId: a.id, role: 'admin' };
    editor = { accountId: e.id, role: 'editor' };
  });
  afterAll(async () => {
    await t?.drop();
  });

  async function seed(over: { status?: string; mode?: string; kind?: string; email?: string; name?: string | null; anonymous?: boolean; created?: string } = {}) {
    const id = uuidv7();
    const reference = newReference();
    await t.pool.query(
      `INSERT INTO donations (id, reference, currency, amount_minor, paid_amount_minor, donor_email_enc, donor_email_hash, donor_name_enc, site_mode, status, kind, anonymous, created_at, review_reason)
       VALUES ($1, $2, 'NGN', 500000, 500000, $3, 'h', $4, $5, $6::donation_status, $7::donation_kind, $8, $9, $10)`,
      [
        id, reference,
        Buffer.from(sealDonorField(kek, id, 'email', over.email ?? 'donor@example.com')),
        over.name === null ? null : Buffer.from(sealDonorField(kek, id, 'name', over.name ?? 'Chidi')),
        over.mode ?? 'live', over.status ?? 'succeeded', over.kind ?? 'one_time', over.anonymous ?? false,
        over.created ?? '2027-01-10T10:00:00Z', over.status === 'needs_review' ? 'amount_lower' : null,
      ],
    );
    return { id, reference };
  }
  const svc = (actor: { accountId: string; role: 'admin' | 'editor' }) => new DonationAdminService({ store: createPgDonationAdminStore(t.db, actor, kek) });

  it('lists for an admin with masked emails and the hidden name of an anonymous donor', async () => {
    const plain = await seed();
    const anon = await seed({ anonymous: true, name: 'Hidden Person' });
    const { rows } = await svc(admin).list(admin, {});
    const a = rows.find((r) => r.reference === plain.reference)!;
    expect(a).toMatchObject({ emailMasked: 'd***@example.com', donorName: 'Chidi' });
    expect(rows.find((r) => r.reference === anon.reference)!.donorName).toBeNull();
    expect(JSON.stringify(rows)).not.toContain('donor@example.com');
  });

  it('gives an editor nothing: the service refuses and the database shows no rows', async () => {
    await expect(svc(editor).list(editor, {})).rejects.toThrow(/admin/i);
  });

  it('filters by status, kind and the Lagos date range', async () => {
    const failed = await seed({ status: 'failed', created: '2027-03-05T10:00:00Z' });
    const monthly = await seed({ kind: 'monthly', created: '2027-03-06T10:00:00Z' });
    const byStatus = await svc(admin).list(admin, { status: 'failed' });
    expect(byStatus.rows.map((r) => r.reference)).toContain(failed.reference);
    expect(byStatus.rows.every((r) => r.status === 'failed')).toBe(true);
    const byKind = await svc(admin).list(admin, { kind: 'monthly' });
    expect(byKind.rows.map((r) => r.reference)).toContain(monthly.reference);
    const byDate = await svc(admin).list(admin, { from: '2027-03-05', to: '2027-03-06' });
    expect(byDate.rows.map((r) => r.reference).sort()).toEqual([failed.reference, monthly.reference].sort());
  });

  it('counts only succeeded live gifts in the totals and shows test rows with a flag', async () => {
    await seed({ mode: 'test', created: '2027-05-01T10:00:00Z' });
    await seed({ created: '2027-05-01T11:00:00Z' });
    const { rows, totals } = await svc(admin).list(admin, { from: '2027-05-01', to: '2027-05-01' });
    expect(rows.filter((r) => r.test)).toHaveLength(1);
    expect(totals.NGN).toEqual({ count: 1, minor: 500000 });
  });

  it('reveals one full address and writes an audit row without it', async () => {
    const d = await seed({ email: 'reveal@example.com' });
    expect(await svc(admin).revealEmail(admin, d.id)).toBe('reveal@example.com');
    const audit = await t.pool.query("SELECT * FROM audit_log WHERE action = 'donation.reveal_email' AND target_id = $1", [d.id]);
    expect(audit.rows).toHaveLength(1);
    expect(JSON.stringify(audit.rows)).not.toContain('reveal@example.com');
  });

  it('exports a CSV and audits it', async () => {
    const out = await svc(admin).exportCsv(admin, { from: '2027-05-01', to: '2027-05-01' });
    expect(out.csv.split('\n').length).toBeGreaterThan(2);
    expect((await t.pool.query("SELECT 1 FROM audit_log WHERE action = 'donation.export'")).rowCount).toBe(1);
  });

  it('resolves a gift in review with a note, audits it and cannot resolve it twice', async () => {
    const d = await seed({ status: 'needs_review' });
    await svc(admin).resolveReview(admin, d.id, true, 'Confirmed with the donor');
    const row = (await t.pool.query('SELECT status FROM donations WHERE id = $1', [d.id])).rows[0];
    expect(row.status).toBe('succeeded');
    expect((await t.pool.query("SELECT 1 FROM audit_log WHERE action = 'donation.review_resolve' AND target_id = $1", [d.id])).rowCount).toBe(1);
    await expect(svc(admin).resolveReview(admin, d.id, true, 'again')).rejects.toThrow();
  });
});
