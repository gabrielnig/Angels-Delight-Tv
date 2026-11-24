import { createPaystackProvider, createPgDonationStore, newReference, runProcessEvent, sealDonorField, type JobDeps } from '@ad/payments';
import { chargeSuccessBody, createFakePaystack } from '@ad/payments/testing';
import { createTestDatabase, integrationEnabled, type TestDatabase } from '@ad/db/testing';
import { openAddress } from '@ad/queue';
import { uuidv7 } from '@ad/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createReceiptHook } from './receipt';

describe.skipIf(!integrationEnabled())('donation receipt hook on Postgres', () => {
  let t: TestDatabase;
  beforeAll(async () => {
    t = await createTestDatabase();
  });
  afterAll(async () => {
    await t?.drop();
  });

  const kek = new Uint8Array(32).fill(2);
  const SECRET = 'sk_test_receipt';
  const NOW = new Date('2027-01-05T12:00:00Z');

  async function seed(over: { email?: string | null; name?: string | null } = {}) {
    const id = uuidv7();
    const reference = newReference();
    const email = over.email === undefined ? 'Donor@Example.com' : over.email;
    await t.pool.query(
      `INSERT INTO donations (id, reference, currency, amount_minor, donor_email_enc, donor_email_hash, donor_name_enc, site_mode)
       VALUES ($1, $2, 'NGN', 250000, $3, 'h', $4, 'test')`,
      [
        id,
        reference,
        email === null ? Buffer.from('garbage') : Buffer.from(sealDonorField(kek, id, 'email', email)),
        over.name ? Buffer.from(sealDonorField(kek, id, 'name', over.name)) : null,
      ],
    );
    return { id, reference };
  }

  function setup() {
    const fake = createFakePaystack({ secretKey: SECRET });
    const provider = createPaystackProvider({ secretKey: SECRET, baseUrl: 'https://api.paystack.co', fetch: fake.fetch });
    const warnings: string[] = [];
    const deps: JobDeps = {
      db: t.db,
      store: createPgDonationStore(t.db),
      provider,
      mode: 'test',
      onSucceeded: createReceiptHook({ kek, orgName: async () => 'Sample Org', warn: (m) => warnings.push(m), now: () => NOW }),
      open: async (b) => b,
      now: () => NOW,
      enqueueEvent: async () => undefined,
    };
    return { fake, provider, deps, warnings };
  }
  async function pay(s: ReturnType<typeof setup>, reference: string) {
    await s.provider.initialize({ amountMinor: 250_000, currency: 'NGN', email: 'd@example.com', reference, callbackUrl: 'https://x.test/t' });
    s.fake.settle(reference, 'success');
    const id = (await t.pool.query("SELECT payment_event_insert('paystack', $1, 'charge.success', NULL, $2) AS id", [`k-${reference}-${Math.random()}`, Buffer.from(chargeSuccessBody({ reference, amount: 250_000 }))])).rows[0].id;
    return Number(id);
  }
  const outbox = async (donationId: string) =>
    (await t.pool.query("SELECT kind, vars, to_enc, id, dedupe_key FROM email_outbox WHERE dedupe_key = $1", [`receipt:${donationId}`])).rows;

  it('queues one receipt to the typed email and sets receipt_sent_at, in the same transaction as the status change', async () => {
    const s = setup();
    const d = await seed({ name: 'Chidi' });
    const eventId = await pay(s, d.reference);
    expect(await runProcessEvent(s.deps, eventId, { attempt: 1, isLastAttempt: false })).toBe('succeeded');
    const rows = await outbox(d.id);
    expect(rows).toHaveLength(1);
    expect(rows[0].kind).toBe('donation_receipt');
    expect(rows[0].vars).toMatchObject({ reference: d.reference, orgName: 'Sample Org', donorName: 'Chidi' });
    expect(openAddress(kek, `outbox:${rows[0].id}`, rows[0].to_enc)).toBe('Donor@Example.com');
    const row = (await t.pool.query('SELECT status, receipt_sent_at FROM donations WHERE id = $1', [d.id])).rows[0];
    expect(row.status).toBe('succeeded');
    expect(row.receipt_sent_at).not.toBeNull();
  });

  it('queues nothing a second time when the event runs again', async () => {
    const s = setup();
    const d = await seed();
    const first = await pay(s, d.reference);
    await runProcessEvent(s.deps, first, { attempt: 1, isLastAttempt: false });
    const second = (await t.pool.query("SELECT payment_event_insert('paystack', $1, 'charge.success', NULL, $2) AS id", [`again-${d.reference}`, Buffer.from(chargeSuccessBody({ reference: d.reference, amount: 250_000 }))])).rows[0].id;
    await runProcessEvent(s.deps, Number(second), { attempt: 1, isLastAttempt: false });
    expect(await outbox(d.id)).toHaveLength(1);
  });

  it('keeps the donation succeeded and warns, with no address in the warning, when the email cannot be opened', async () => {
    const s = setup();
    const d = await seed({ email: null });
    const eventId = await pay(s, d.reference);
    expect(await runProcessEvent(s.deps, eventId, { attempt: 1, isLastAttempt: false })).toBe('succeeded');
    expect(await outbox(d.id)).toHaveLength(0);
    expect(s.warnings).toEqual(['donation receipt skipped: the donor email could not be read']);
    expect((await t.pool.query('SELECT status, receipt_sent_at FROM donations WHERE id = $1', [d.id])).rows[0]).toMatchObject({ status: 'succeeded', receipt_sent_at: null });
  });

  it('sends no receipt for a gift that needs review', async () => {
    const s = setup();
    const d = await seed();
    await s.provider.initialize({ amountMinor: 250_000, currency: 'NGN', email: 'd@example.com', reference: d.reference, callbackUrl: 'https://x.test/t' });
    s.fake.settle(d.reference, 'success', { amount: 100_000 });
    const id = (await t.pool.query("SELECT payment_event_insert('paystack', $1, 'charge.success', NULL, $2) AS id", [`low-${d.reference}`, Buffer.from(chargeSuccessBody({ reference: d.reference, amount: 100_000 }))])).rows[0].id;
    expect(await runProcessEvent(s.deps, Number(id), { attempt: 1, isLastAttempt: false })).toBe('needs_review');
    expect(await outbox(d.id)).toHaveLength(0);
  });
});
