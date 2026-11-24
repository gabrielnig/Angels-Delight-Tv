import { describe, expect, it } from 'vitest';
import { createFakePaystack } from './testing/fake-paystack';
import { createPaystackProvider } from './paystack';
import { PaymentError } from './provider';
import { newReference } from './reference';

const make = () => {
  const fake = createFakePaystack({ secretKey: 'sk_test_abc123secret' });
  const provider = createPaystackProvider({
    secretKey: 'sk_test_abc123secret',
    baseUrl: 'https://api.paystack.co',
    fetch: fake.fetch,
  });
  return { fake, provider };
};
const input = (reference = newReference()) => ({
  amountMinor: 250_000,
  currency: 'NGN' as const,
  email: 'donor@example.com',
  reference,
  callbackUrl: 'https://site.example/donate/thank-you',
  metadata: { donation: 'one-time', purpose: 'general' },
});

describe('initialize', () => {
  it('sends the amount in kobo with currency, reference, email, callback_url and metadata', async () => {
    const { fake, provider } = make();
    const i = input();
    const out = await provider.initialize(i);
    expect(out).toMatchObject({ reference: i.reference });
    expect(out.authorizationUrl).toMatch(/^https:\/\/checkout\.paystack\.test\//);
    const call = fake.calls[0]!;
    expect(call.method).toBe('POST');
    expect(call.path).toBe('/transaction/initialize');
    expect(call.headers.authorization).toBe('Bearer sk_test_abc123secret');
    expect(call.body).toMatchObject({
      amount: 250_000,
      currency: 'NGN',
      email: 'donor@example.com',
      reference: i.reference,
      callback_url: 'https://site.example/donate/thank-you',
    });
    expect(typeof call.body!.metadata).toBe('string');
    expect(JSON.parse(call.body!.metadata as string)).toEqual({ donation: 'one-time', purpose: 'general' });
  });
  it('never sends card fields or anything outside the known set', async () => {
    const { fake, provider } = make();
    await provider.initialize(input());
    const keys = Object.keys(fake.calls[0]!.body!);
    expect(keys.sort()).toEqual(['amount', 'callback_url', 'currency', 'email', 'metadata', 'reference']);
  });
  it('sends the plan code for monthly giving', async () => {
    const { fake, provider } = make();
    await provider.initialize({ ...input(), planCode: 'PLN_abc' });
    expect(fake.calls[0]!.body).toMatchObject({ plan: 'PLN_abc' });
  });
  it('refuses an amount that is not a whole number before calling out', async () => {
    const { fake, provider } = make();
    await expect(provider.initialize({ ...input(), amountMinor: 10.5 })).rejects.toMatchObject({ code: 'rejected', retryable: false });
    expect(fake.calls).toHaveLength(0);
  });
});

describe('verify', () => {
  const expected = { amountMinor: 250_000, currency: 'NGN' as const };
  it('returns paid only when status is success and amount and currency match', async () => {
    const { fake, provider } = make();
    const i = input();
    await provider.initialize(i);
    fake.settle(i.reference, 'success');
    const out = await provider.verify(i.reference, expected);
    expect(out).toMatchObject({ status: 'paid', amountMinor: 250_000, currency: 'NGN' });
    expect(out.status === 'paid' && out.paidAt?.toISOString()).toBe('2027-01-05T10:00:00.000Z');
  });
  it('accepts an amount above the expected one and reports what was paid', async () => {
    const { fake, provider } = make();
    const i = input();
    await provider.initialize(i);
    fake.settle(i.reference, 'success', { amount: 300_000 });
    expect(await provider.verify(i.reference, expected)).toMatchObject({ status: 'paid', amountMinor: 300_000 });
  });
  it('returns needs_review when the amount is lower than expected', async () => {
    const { fake, provider } = make();
    const i = input();
    await provider.initialize(i);
    fake.settle(i.reference, 'success', { amount: 100_000 });
    expect(await provider.verify(i.reference, expected)).toMatchObject({ status: 'needs_review', reason: 'amount_lower', amountMinor: 100_000 });
  });
  it('returns needs_review when the currency differs', async () => {
    const { fake, provider } = make();
    const i = input();
    await provider.initialize(i);
    fake.settle(i.reference, 'success', { currency: 'USD' });
    expect(await provider.verify(i.reference, expected)).toMatchObject({ status: 'needs_review', reason: 'currency_mismatch' });
  });
  it('maps failed, abandoned and anything still open', async () => {
    const { fake, provider } = make();
    for (const [status, mapped] of [['failed', 'failed'], ['abandoned', 'abandoned'], ['ongoing', 'pending']] as const) {
      const i = input();
      await provider.initialize(i);
      fake.settle(i.reference, status);
      expect((await provider.verify(i.reference, expected)).status).toBe(mapped);
    }
  });
  it('treats an unknown reference as a rejected, not retryable call', async () => {
    const { provider } = make();
    await expect(provider.verify(newReference(), expected)).rejects.toMatchObject({ code: 'rejected', retryable: false, httpStatus: 404 });
  });
  it('refuses a reference that is not ours before calling out', async () => {
    const { fake, provider } = make();
    await expect(provider.verify('../../admin', expected)).rejects.toMatchObject({ code: 'rejected' });
    expect(fake.calls).toHaveLength(0);
  });
});

describe('errors', () => {
  it('surfaces a network error as a typed retryable error', async () => {
    const { fake, provider } = make();
    fake.failNext('network');
    const error = await provider.initialize(input()).catch((e) => e);
    expect(error).toBeInstanceOf(PaymentError);
    expect(error).toMatchObject({ code: 'network', retryable: true });
  });
  it('maps timeout, 429 and 5xx to retryable and a garbage body to bad_response', async () => {
    const { fake, provider } = make();
    fake.failNext('timeout');
    expect(await provider.initialize(input()).catch((e) => e)).toMatchObject({ code: 'timeout', retryable: true });
    fake.failNext('rate_limited');
    expect(await provider.initialize(input()).catch((e) => e)).toMatchObject({ code: 'rate_limited', retryable: true });
    fake.failNext('server');
    expect(await provider.initialize(input()).catch((e) => e)).toMatchObject({ code: 'server', retryable: true });
    fake.failNext('garbage');
    expect(await provider.initialize(input()).catch((e) => e)).toMatchObject({ code: 'bad_response' });
  });
  it('maps a wrong key to unauthorized and not retryable', async () => {
    const fake = createFakePaystack({ secretKey: 'sk_test_right' });
    const provider = createPaystackProvider({ secretKey: 'sk_test_wrong', baseUrl: 'https://api.paystack.co', fetch: fake.fetch });
    expect(await provider.initialize(input()).catch((e) => e)).toMatchObject({ code: 'unauthorized', retryable: false });
  });
  it('never puts the secret key in an error message, stack or cause', async () => {
    const secret = 'sk_test_abc123secret';
    const { fake, provider } = make();
    for (const kind of ['network', 'timeout', 'server', 'rate_limited', 'garbage'] as const) {
      fake.failNext(kind);
      const e = (await provider.initialize(input()).catch((x) => x)) as Error;
      expect(`${e.message} ${e.stack ?? ''} ${JSON.stringify(e)}`).not.toContain(secret);
    }
    const wrong = createPaystackProvider({ secretKey: secret, baseUrl: 'https://api.paystack.co', fetch: createFakePaystack({ secretKey: 'other' }).fetch });
    const e = (await wrong.initialize(input()).catch((x) => x)) as Error;
    expect(`${e.message} ${e.stack ?? ''}`).not.toContain(secret);
  });
  it('refuses to build a provider with an empty key', () => {
    expect(() => createPaystackProvider({ secretKey: '', baseUrl: 'https://api.paystack.co' })).toThrow();
  });
});
