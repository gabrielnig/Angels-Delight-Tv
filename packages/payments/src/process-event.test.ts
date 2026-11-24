import { describe, expect, it, vi } from 'vitest';
import { createFakePaystack } from './testing/fake-paystack';
import { createPaystackProvider } from './paystack';
import { memoryDonationStore } from './testing/memory-store';
import { processEvent, RetryLater, ORPHAN_AFTER_ATTEMPTS, type ProcessDeps } from './process-event';
import { newReference } from './reference';

const SECRET = 'sk_test_abc';
const setup = (mode: 'test' | 'live' = 'test') => {
  const fake = createFakePaystack({ secretKey: SECRET });
  const provider = createPaystackProvider({ secretKey: SECRET, baseUrl: 'https://api.paystack.co', fetch: fake.fetch });
  const store = memoryDonationStore();
  const onSucceeded = vi.fn(async () => undefined);
  const deps: ProcessDeps = { store, provider, mode, onSucceeded };
  return { fake, provider, store, onSucceeded, deps };
};

async function pendingDonation(s: ReturnType<typeof setup>, over: { amountMinor?: number; currency?: 'NGN' | 'USD'; siteMode?: 'test' | 'live' } = {}) {
  const reference = newReference();
  const amountMinor = over.amountMinor ?? 250_000;
  const currency = over.currency ?? 'NGN';
  s.store.add({ reference, amountMinor, currency, siteMode: over.siteMode ?? 'test' });
  await s.provider.initialize({ amountMinor, currency, email: 'd@example.com', reference, callbackUrl: 'https://x.test/t' });
  return { reference, amountMinor, currency };
}
const success = (reference: string, extra: Record<string, unknown> = {}) => ({
  eventType: 'charge.success',
  attempt: 1,
  payload: { event: 'charge.success', data: { reference, status: 'success', id: 99, channel: 'card', fees: 3_750, domain: 'test', paid_at: '2027-01-05T10:00:00.000Z', ...extra } },
});

describe('charge.success', () => {
  it('marks the donation succeeded once and queues the receipt once', async () => {
    const s = setup();
    const d = await pendingDonation(s);
    s.fake.settle(d.reference, 'success');
    expect(await processEvent(s.deps, success(d.reference))).toBe('succeeded');
    const row = s.store.get(d.reference)!;
    expect(row).toMatchObject({ status: 'succeeded', paidAmountMinor: 250_000, providerTxnId: '99', channel: 'card', feeMinor: 3_750, netMinor: 246_250 });
    expect(row.paidAt?.toISOString()).toBe('2027-01-05T10:00:00.000Z');
    expect(s.onSucceeded).toHaveBeenCalledTimes(1);
  });
  it('a replayed event changes nothing and sends no second receipt', async () => {
    const s = setup();
    const d = await pendingDonation(s);
    s.fake.settle(d.reference, 'success');
    await processEvent(s.deps, success(d.reference));
    expect(await processEvent(s.deps, success(d.reference))).toBe('already_succeeded');
    expect(s.onSucceeded).toHaveBeenCalledTimes(1);
  });
  it('concurrent duplicate events produce one success', async () => {
    const s = setup();
    const d = await pendingDonation(s);
    s.fake.settle(d.reference, 'success');
    const results = await Promise.all(Array.from({ length: 5 }, () => processEvent(s.deps, success(d.reference))));
    expect(results.filter((r) => r === 'succeeded')).toHaveLength(1);
    expect(s.onSucceeded).toHaveBeenCalledTimes(1);
  });
  it('flags a lower paid amount for review and sends no receipt', async () => {
    const s = setup();
    const d = await pendingDonation(s);
    s.fake.settle(d.reference, 'success', { amount: 100_000 });
    expect(await processEvent(s.deps, success(d.reference))).toBe('needs_review');
    expect(s.store.get(d.reference)).toMatchObject({ status: 'needs_review', reviewReason: 'amount_lower', paidAmountMinor: 100_000 });
    expect(s.onSucceeded).not.toHaveBeenCalled();
  });
  it('flags a currency mismatch for review', async () => {
    const s = setup();
    const d = await pendingDonation(s);
    s.fake.settle(d.reference, 'success', { currency: 'USD' });
    expect(await processEvent(s.deps, success(d.reference))).toBe('needs_review');
    expect(s.store.get(d.reference)?.reviewReason).toBe('currency_mismatch');
  });
  it('never trusts the event body for the amount: the provider answer decides', async () => {
    const s = setup();
    const d = await pendingDonation(s);
    s.fake.settle(d.reference, 'success', { amount: 100_000 });
    await processEvent(s.deps, success(d.reference, { amount: 250_000 }));
    expect(s.store.get(d.reference)?.status).toBe('needs_review');
  });
  it('asks to retry when the row is not there yet, then stores an orphan after enough tries', async () => {
    const s = setup();
    const reference = newReference();
    await expect(processEvent(s.deps, success(reference))).rejects.toBeInstanceOf(RetryLater);
    expect(await processEvent(s.deps, { ...success(reference), attempt: ORPHAN_AFTER_ATTEMPTS })).toBe('orphan');
    expect(s.onSucceeded).not.toHaveBeenCalled();
  });
  it('ignores a reference that is not one of ours', async () => {
    const s = setup();
    expect(await processEvent(s.deps, success('SOME-OTHER-SHOP-REF'))).toBe('orphan');
  });
  it('asks to retry when the provider still says the payment is open', async () => {
    const s = setup();
    const d = await pendingDonation(s);
    await expect(processEvent(s.deps, success(d.reference))).rejects.toBeInstanceOf(RetryLater);
    expect(s.store.get(d.reference)?.status).toBe('pending');
  });
  it('lets a provider outage bubble up so the queue retries', async () => {
    const s = setup();
    const d = await pendingDonation(s);
    s.fake.failNext('server');
    await expect(processEvent(s.deps, success(d.reference))).rejects.toMatchObject({ retryable: true });
  });
  it('rejects a test event when running with a live key and the other way round', async () => {
    const live = setup('live');
    const d = await pendingDonation(live, { siteMode: 'live' });
    live.fake.settle(d.reference, 'success');
    expect(await processEvent(live.deps, success(d.reference, { domain: 'test' }))).toBe('mode_mismatch');
    expect(live.store.get(d.reference)?.status).toBe('pending');
    const test = setup('test');
    const d2 = await pendingDonation(test, { siteMode: 'live' });
    test.fake.settle(d2.reference, 'success');
    expect(await processEvent(test.deps, success(d2.reference))).toBe('mode_mismatch');
  });
  it('does not turn a refunded or failed row back into a success', async () => {
    const s = setup();
    const d = await pendingDonation(s);
    s.fake.settle(d.reference, 'success');
    s.store.get(d.reference)!.status = 'refunded';
    expect(await processEvent(s.deps, success(d.reference))).toBe('already_final');
    expect(s.store.get(d.reference)?.status).toBe('refunded');
    expect(s.onSucceeded).not.toHaveBeenCalled();
  });
  it('a late success still lands on an abandoned donation', async () => {
    const s = setup();
    const d = await pendingDonation(s);
    s.store.get(d.reference)!.status = 'abandoned';
    s.fake.settle(d.reference, 'success');
    expect(await processEvent(s.deps, success(d.reference))).toBe('succeeded');
  });
});

describe('other events', () => {
  it('marks a pending donation failed on charge.failed and keeps a succeeded one', async () => {
    const s = setup();
    const d = await pendingDonation(s);
    const failed = { eventType: 'charge.failed', attempt: 1, payload: { event: 'charge.failed', data: { reference: d.reference, domain: 'test' } } };
    expect(await processEvent(s.deps, failed)).toBe('failed');
    expect(s.store.get(d.reference)?.status).toBe('failed');
    const e = await pendingDonation(s);
    s.fake.settle(e.reference, 'success');
    await processEvent(s.deps, success(e.reference));
    expect(await processEvent(s.deps, { ...failed, payload: { event: 'charge.failed', data: { reference: e.reference, domain: 'test' } } })).toBe('already_final');
    expect(s.store.get(e.reference)?.status).toBe('succeeded');
  });
  it('marks refunded on refund.processed and keeps the original amount', async () => {
    const s = setup();
    const d = await pendingDonation(s);
    s.fake.settle(d.reference, 'success');
    await processEvent(s.deps, success(d.reference));
    const refund = { eventType: 'refund.processed', attempt: 1, payload: { event: 'refund.processed', data: { transaction_reference: d.reference, amount: 250_000, domain: 'test' } } };
    expect(await processEvent(s.deps, refund)).toBe('refunded');
    expect(s.store.get(d.reference)).toMatchObject({ status: 'refunded', amountMinor: 250_000, paidAmountMinor: 250_000 });
  });
  it('stores unknown event types as ignored', async () => {
    const s = setup();
    expect(await processEvent(s.deps, { eventType: 'transfer.success', attempt: 1, payload: { event: 'transfer.success', data: {} } })).toBe('ignored');
    expect(await processEvent(s.deps, { eventType: 'charge.success', attempt: 1, payload: 'garbage' })).toBe('ignored');
  });
});
