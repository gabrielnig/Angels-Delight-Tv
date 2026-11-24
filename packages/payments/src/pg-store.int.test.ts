import { randomBytes } from 'node:crypto';
import { uuidv7 } from '@ad/shared';
import { createTestDatabase, integrationEnabled, makeAccount, type TestDatabase } from '@ad/db/testing';
import { schema } from '@ad/db';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createPgDonationStore } from './pg-store';
import { createPaystackProvider } from './paystack';
import { processEvent, type ProcessDeps } from './process-event';
import { createFakePaystack } from './testing/fake-paystack';
import { newReference } from './reference';

describe.skipIf(!integrationEnabled())('processing donation events on Postgres', () => {
  let t: TestDatabase;
  beforeAll(async () => {
    t = await createTestDatabase();
  });
  afterAll(async () => {
    await t?.drop();
  });

  const SECRET = 'sk_test_pg';
  async function setup() {
    const fake = createFakePaystack({ secretKey: SECRET });
    const provider = createPaystackProvider({ secretKey: SECRET, baseUrl: 'https://api.paystack.co', fetch: fake.fetch });
    const onSucceeded = vi.fn(async () => undefined);
    const deps: ProcessDeps = { store: createPgDonationStore(t.db), provider, mode: 'test', onSucceeded };
    const reference = newReference();
    await t.pool.query(
      `INSERT INTO donations (id, reference, currency, amount_minor, donor_email_enc, donor_email_hash, site_mode) VALUES ($1, $2, 'NGN', 250000, 'e', 'h', 'test')`,
      [uuidv7(), reference],
    );
    await provider.initialize({ amountMinor: 250_000, currency: 'NGN', email: 'd@example.com', reference, callbackUrl: 'https://x.test/t' });
    return { fake, deps, reference, onSucceeded };
  }
  const event = (reference: string) => ({
    eventType: 'charge.success',
    attempt: 1,
    payload: { event: 'charge.success', data: { reference, id: 5, channel: 'card', fees: 3750, domain: 'test' } },
  });
  const row = async (reference: string) =>
    (await t.pool.query('SELECT status, paid_amount_minor, fee_minor, net_minor, channel, provider_txn_id, paid_at FROM donations WHERE reference = $1', [reference])).rows[0];

  it('marks a donation succeeded once with the provider amounts', async () => {
    const s = await setup();
    s.fake.settle(s.reference, 'success');
    expect(await processEvent(s.deps, event(s.reference))).toBe('succeeded');
    expect(await row(s.reference)).toMatchObject({ status: 'succeeded', paid_amount_minor: '250000', fee_minor: '3750', net_minor: '246250', channel: 'card', provider_txn_id: '5' });
    expect(s.onSucceeded).toHaveBeenCalledTimes(1);
  });

  it('serialises concurrent duplicate events by reference so only one succeeds', async () => {
    const s = await setup();
    s.fake.settle(s.reference, 'success');
    const results = await Promise.all(Array.from({ length: 6 }, () => processEvent(s.deps, event(s.reference))));
    expect(results.filter((r) => r === 'succeeded')).toHaveLength(1);
    expect(results.filter((r) => r === 'already_succeeded')).toHaveLength(5);
    expect(s.onSucceeded).toHaveBeenCalledTimes(1);
  });

  it('rolls the status change back when the receipt step throws, so a retry can finish the job', async () => {
    const s = await setup();
    s.fake.settle(s.reference, 'success');
    s.onSucceeded.mockRejectedValueOnce(new Error('outbox down'));
    await expect(processEvent(s.deps, event(s.reference))).rejects.toThrow('outbox down');
    expect((await row(s.reference)).status).toBe('pending');
    expect(await processEvent(s.deps, event(s.reference))).toBe('succeeded');
    expect(s.onSucceeded).toHaveBeenCalledTimes(2);
  });

  it('flags a lower paid amount and writes nothing to accounts or profiles', async () => {
    const acct = makeAccount({ role: 'viewer' });
    await t.db.insert(schema.accounts).values(acct);
    const before = (await t.pool.query('SELECT (SELECT count(*) FROM accounts) AS a, (SELECT count(*) FROM profiles) AS p')).rows[0];
    const s = await setup();
    s.fake.settle(s.reference, 'success', { amount: 100_000 });
    expect(await processEvent(s.deps, event(s.reference))).toBe('needs_review');
    expect(await row(s.reference)).toMatchObject({ status: 'needs_review', paid_amount_minor: '100000' });
    expect(s.onSucceeded).not.toHaveBeenCalled();
    const after = (await t.pool.query('SELECT (SELECT count(*) FROM accounts) AS a, (SELECT count(*) FROM profiles) AS p')).rows[0];
    expect(after).toEqual(before);
    expect(randomBytes(1).length).toBe(1);
  });
});
