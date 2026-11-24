import { uuidv7 } from '@ad/shared';
import { createTestDatabase, integrationEnabled, type TestDatabase } from '@ad/db/testing';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { pruneEvents, reconcileDonations, runProcessEvent, type JobDeps } from './jobs';
import { createPaystackProvider } from './paystack';
import { createPgDonationStore } from './pg-store';
import { createFakePaystack, chargeSuccessBody } from './testing/fake-paystack';
import { newReference } from './reference';

describe.skipIf(!integrationEnabled())('donation worker jobs on Postgres', () => {
  let t: TestDatabase;
  beforeAll(async () => {
    t = await createTestDatabase();
  });
  afterAll(async () => {
    await t?.drop();
  });

  const SECRET = 'sk_test_jobs';
  const NOW = new Date('2027-01-05T12:00:00Z');
  const ago = (minutes: number) => new Date(NOW.getTime() - minutes * 60_000);

  function setup() {
    const fake = createFakePaystack({ secretKey: SECRET });
    const provider = createPaystackProvider({ secretKey: SECRET, baseUrl: 'https://api.paystack.co', fetch: fake.fetch });
    const onSucceeded = vi.fn(async () => undefined);
    const enqueueEvent = vi.fn(async (_id: number) => undefined);
    const deps: JobDeps = {
      db: t.db,
      store: createPgDonationStore(t.db),
      provider,
      mode: 'test',
      onSucceeded,
      open: async (b) => b,
      now: () => NOW,
      enqueueEvent,
    };
    return { fake, provider, deps, onSucceeded, enqueueEvent };
  }
  async function donation(s: ReturnType<typeof setup>, ageMinutes: number, status = 'pending') {
    const reference = newReference();
    await t.pool.query(
      `INSERT INTO donations (id, reference, currency, amount_minor, donor_email_enc, donor_email_hash, site_mode, status, created_at)
       VALUES ($1, $2, 'NGN', 250000, 'e', 'h', 'test', $3::donation_status, $4)`,
      [uuidv7(), reference, status, ago(ageMinutes)],
    );
    await s.provider.initialize({ amountMinor: 250_000, currency: 'NGN', email: 'd@example.com', reference, callbackUrl: 'https://x.test/t' });
    return reference;
  }
  const status = async (reference: string) => (await t.pool.query('SELECT status FROM donations WHERE reference = $1', [reference])).rows[0]?.status as string;

  describe('reconcile', () => {
    it('verifies a pending donation older than 15 minutes and marks it succeeded', async () => {
      const s = setup();
      const old = await donation(s, 20);
      s.fake.settle(old, 'success');
      const result = await reconcileDonations(s.deps);
      expect(await status(old)).toBe('succeeded');
      expect(result.succeeded).toBeGreaterThanOrEqual(1);
      expect(s.onSucceeded).toHaveBeenCalledTimes(1);
    });
    it('leaves a pending donation younger than 15 minutes alone', async () => {
      const s = setup();
      const young = await donation(s, 5);
      s.fake.settle(young, 'success');
      await reconcileDonations(s.deps);
      expect(await status(young)).toBe('pending');
      expect(s.fake.calls.filter((c) => c.path.includes(young))).toHaveLength(0);
    });
    it('marks a failed payment failed', async () => {
      const s = setup();
      const ref = await donation(s, 30);
      s.fake.settle(ref, 'failed');
      await reconcileDonations(s.deps);
      expect(await status(ref)).toBe('failed');
    });
    it('marks a pending donation older than 24 hours abandoned when it was never paid', async () => {
      const s = setup();
      const ref = await donation(s, 25 * 60);
      await reconcileDonations(s.deps);
      expect(await status(ref)).toBe('abandoned');
    });
    it('still records a late payment on a donation older than 24 hours', async () => {
      const s = setup();
      const ref = await donation(s, 26 * 60);
      s.fake.settle(ref, 'success');
      await reconcileDonations(s.deps);
      expect(await status(ref)).toBe('succeeded');
    });
    it('keeps going when one verify call fails and retries it on the next run', async () => {
      const s = setup();
      const a = await donation(s, 40);
      const b = await donation(s, 41);
      s.fake.settle(a, 'success');
      s.fake.settle(b, 'success');
      s.fake.failNext('server');
      const first = await reconcileDonations(s.deps);
      expect(first.errors).toBe(1);
      const second = await reconcileDonations(s.deps);
      expect(second.errors).toBe(0);
      expect(await status(a)).toBe('succeeded');
      expect(await status(b)).toBe('succeeded');
    });
    it('never downgrades a succeeded donation', async () => {
      const s = setup();
      const ref = await donation(s, 120, 'succeeded');
      s.fake.settle(ref, 'failed');
      await reconcileDonations(s.deps);
      expect(await status(ref)).toBe('succeeded');
    });
    it('queues stored events that were never processed after five minutes', async () => {
      const s = setup();
      const id = (await t.pool.query("SELECT payment_event_insert('paystack', 'stuck-1', 'charge.success', NULL, 'x'::bytea) AS id")).rows[0].id;
      await t.pool.query('UPDATE payment_events SET received_at = $2 WHERE id = $1', [id, ago(10)]);
      const fresh = (await t.pool.query("SELECT payment_event_insert('paystack', 'fresh-1', 'charge.success', NULL, 'x'::bytea) AS id")).rows[0].id;
      await t.pool.query('UPDATE payment_events SET received_at = $2 WHERE id = $1', [fresh, ago(1)]);
      await reconcileDonations(s.deps);
      const ids = s.enqueueEvent.mock.calls.map((c) => c[0]);
      expect(ids).toContain(Number(id));
      expect(ids).not.toContain(Number(fresh));
    });
  });

  describe('process event job', () => {
    async function storeEvent(body: string, key: string) {
      const id = (await t.pool.query("SELECT payment_event_insert('paystack', $1, 'charge.success', NULL, $2) AS id", [key, Buffer.from(body)])).rows[0].id;
      return Number(id);
    }
    it('processes a stored event, records the outcome and marks it done', async () => {
      const s = setup();
      const ref = await donation(s, 1);
      s.fake.settle(ref, 'success');
      const id = await storeEvent(chargeSuccessBody({ reference: ref, amount: 250_000 }), `k-${ref}`);
      expect(await runProcessEvent(s.deps, id, { attempt: 1, isLastAttempt: false })).toBe('succeeded');
      const row = (await t.pool.query('SELECT outcome, processed_at, attempts FROM payment_events WHERE id = $1', [id])).rows[0];
      expect(row.outcome).toBe('succeeded');
      expect(row.processed_at).not.toBeNull();
      expect(row.attempts).toBe(1);
      expect(await runProcessEvent(s.deps, id, { attempt: 2, isLastAttempt: false })).toBe('skipped');
      expect(s.onSucceeded).toHaveBeenCalledTimes(1);
    });
    it('retries when the donation row is not there yet and stores an orphan on the third try', async () => {
      const s = setup();
      const ref = newReference();
      const id = await storeEvent(chargeSuccessBody({ reference: ref, amount: 250_000 }), `k-${ref}`);
      await expect(runProcessEvent(s.deps, id, { attempt: 1, isLastAttempt: false })).rejects.toThrow();
      expect((await t.pool.query('SELECT processed_at FROM payment_events WHERE id = $1', [id])).rows[0].processed_at).toBeNull();
      expect(await runProcessEvent(s.deps, id, { attempt: 3, isLastAttempt: false })).toBe('orphan');
    });
    it('ends in a failed state with the error recorded when the last try fails', async () => {
      const s = setup();
      const ref = await donation(s, 1);
      s.fake.settle(ref, 'success');
      const id = await storeEvent(chargeSuccessBody({ reference: ref, amount: 250_000 }), `k-${ref}`);
      s.fake.failNext('server');
      await expect(runProcessEvent(s.deps, id, { attempt: 6, isLastAttempt: true })).resolves.toBe('failed');
      const row = (await t.pool.query('SELECT outcome, error, processed_at FROM payment_events WHERE id = $1', [id])).rows[0];
      expect(row.outcome).toBe('failed');
      expect(row.processed_at).not.toBeNull();
      expect(row.error).toContain('Paystack');
      expect(row.error).not.toContain(SECRET);
    });
    it('marks an event whose payload cannot be read as failed without retrying', async () => {
      const s = setup();
      const id = await storeEvent('{not json', 'k-bad');
      expect(await runProcessEvent(s.deps, id, { attempt: 1, isLastAttempt: false })).toBe('failed');
    });
  });

  describe('prune events', () => {
    it('empties payloads of processed events older than the retention days and keeps the rows', async () => {
      const old = (await t.pool.query("SELECT payment_event_insert('paystack', 'p-old', 'x', NULL, 'secret'::bytea) AS id")).rows[0].id;
      const recent = (await t.pool.query("SELECT payment_event_insert('paystack', 'p-new', 'x', NULL, 'secret'::bytea) AS id")).rows[0].id;
      const open = (await t.pool.query("SELECT payment_event_insert('paystack', 'p-open', 'x', NULL, 'secret'::bytea) AS id")).rows[0].id;
      await t.pool.query('UPDATE payment_events SET received_at = $2, processed_at = $2 WHERE id = $1', [old, new Date(NOW.getTime() - 100 * 86_400_000)]);
      await t.pool.query('UPDATE payment_events SET received_at = $2, processed_at = $2 WHERE id = $1', [recent, new Date(NOW.getTime() - 10 * 86_400_000)]);
      await t.pool.query('UPDATE payment_events SET received_at = $2 WHERE id = $1', [open, new Date(NOW.getTime() - 100 * 86_400_000)]);
      expect(await pruneEvents(t.db, 90, NOW)).toBe(1);
      const rows = (await t.pool.query('SELECT id, payload_enc IS NULL AS empty FROM payment_events WHERE id = ANY($1)', [[old, recent, open]])).rows;
      const by = Object.fromEntries(rows.map((r) => [String(r.id), r.empty]));
      expect(by[String(old)]).toBe(true);
      expect(by[String(recent)]).toBe(false);
      expect(by[String(open)]).toBe(false);
      expect(await pruneEvents(t.db, 90, NOW)).toBe(0);
    });
  });
});
