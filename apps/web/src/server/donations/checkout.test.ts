import { createFakePaystack } from '@ad/payments/testing';
import { PaymentError, createPaystackProvider, verifyReceiptToken } from '@ad/payments';
import { describe, expect, it, vi } from 'vitest';
import { createCheckoutHandler, type CheckoutDeps } from './checkout';

const kek = new Uint8Array(32).fill(3);
const pepper = new Uint8Array(32).fill(4);
const receiptSecret = new Uint8Array(32).fill(5);
const ATTEMPT = '0190a000-0000-7000-8000-000000000001';
const ORIGIN = 'https://site.example';

const body = (over: Record<string, unknown> = {}) => ({ amountMinor: 100000, currency: 'NGN', email: 'donor@example.com', name: 'Chidi', attemptId: ATTEMPT, ...over });
const post = (data: unknown, headers: Record<string, string> = {}) =>
  new Request(`${ORIGIN}/api/donate/checkout`, {
    method: 'POST',
    body: typeof data === 'string' ? data : JSON.stringify(data),
    headers: { 'content-type': 'application/json', origin: ORIGIN, ...headers },
  });

function make(over: Partial<CheckoutDeps> = {}) {
  const fake = createFakePaystack();
  const real = createPaystackProvider({ secretKey: fake.secretKey, baseUrl: 'https://api.paystack.co', fetch: fake.fetch });
  const created: Array<Record<string, unknown>> = [];
  const initialize = vi.fn(real.initialize.bind(real));
  const deps: CheckoutDeps = {
    config: async () => ({ enabled: true, currencies: ['NGN'], usdEnabled: false, monthlyEnabled: false, limits: { NGN: { min: 20000, max: 500000000 }, USD: { min: 100, max: 5000000 } } }),
    provider: { ...real, initialize },
    resolveViewer: async () => ({ audience: 'general', accountId: null }),
    limiter: { consume: async () => ({ allowed: true, retryAfterSeconds: 0 }) },
    store: {
      findAttempt: async () => null,
      create: async (input) => {
        created.push(input as unknown as Record<string, unknown>);
        return { reference: input.reference, url: input.checkoutUrl, created: true };
      },
    },
    kek,
    pepper,
    receiptSecret,
    appOrigin: ORIGIN,
    trustedProxyMode: 'none',
    siteMode: 'test',
    newId: () => '0190a000-0000-7000-8000-0000000000aa',
    ...over,
  };
  return { handler: createCheckoutHandler(deps), deps, created, initialize, fake };
}

describe('POST /api/donate/checkout', () => {
  it('returns 404 and does nothing when donations are off or no provider is configured', async () => {
    const off = make({ config: async () => ({ enabled: false, currencies: ['NGN'], usdEnabled: false, monthlyEnabled: false, limits: { NGN: { min: 1, max: 2 }, USD: { min: 1, max: 2 } } }) });
    expect((await off.handler(post(body()))).status).toBe(404);
    const none = make({ provider: null });
    expect((await none.handler(post(body()))).status).toBe(404);
    expect(off.initialize).not.toHaveBeenCalled();
  });

  it('returns 403 for kids and for an unknown audience, before reading the body or the limiter', async () => {
    const consume = vi.fn(async () => ({ allowed: true, retryAfterSeconds: 0 }));
    for (const audience of ['kids', undefined, 'weird']) {
      const { handler, initialize, created } = make({ resolveViewer: async () => ({ audience, accountId: null }), limiter: { consume } });
      expect((await handler(post(body()))).status).toBe(403);
      expect(initialize).not.toHaveBeenCalled();
      expect(created).toEqual([]);
    }
    expect(consume).not.toHaveBeenCalled();
  });

  it('returns 403 when the viewer cannot be resolved', async () => {
    const { handler } = make({ resolveViewer: async () => { throw new Error('db down'); } });
    expect((await handler(post(body()))).status).toBe(403);
  });

  it('refuses a cross origin post with 403', async () => {
    const { handler, initialize } = make();
    expect((await handler(post(body(), { origin: 'https://evil.example' }))).status).toBe(403);
    expect(initialize).not.toHaveBeenCalled();
  });

  it.each([
    ['amount below the minimum', { amountMinor: 19999 }, 'amount_low'],
    ['amount above the maximum', { amountMinor: 500000001 }, 'amount_high'],
    ['a fractional amount', { amountMinor: 1000.5 }, 'invalid'],
    ['a string amount', { amountMinor: '1000' }, 'invalid'],
    ['an unknown currency', { currency: 'EUR' }, 'invalid'],
    ['USD when it is not enabled', { currency: 'USD', amountMinor: 1000 }, 'currency'],
    ['an invalid email', { email: 'not-an-email' }, 'invalid'],
    ['a header injecting email', { email: 'a@example.com\r\nbcc: x@example.com' }, 'invalid'],
    ['an extra key (mass assignment)', { accountId: 'x', status: 'succeeded' }, 'invalid'],
    ['a status key', { status: 'succeeded' }, 'invalid'],
    ['monthly when it is off', { kind: 'monthly' }, 'monthly'],
    ['a missing attempt id', { attemptId: undefined }, 'invalid'],
    ['a name that is too long', { name: 'x'.repeat(81) }, 'invalid'],
  ])('returns 400 for %s', async (_label, over, code) => {
    const { handler, initialize, created } = make();
    const res = await handler(post(body(over)));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe(code);
    expect(initialize).not.toHaveBeenCalled();
    expect(created).toEqual([]);
  });

  it('returns 400 for a body that is not json or is too large', async () => {
    const { handler } = make();
    expect((await handler(post('{not json'))).status).toBe(400);
    expect((await handler(post(`{"pad":"${'x'.repeat(5000)}"}`))).status).toBe(400);
  });

  it('returns 429 with Retry-After after the per ip limit and again for the per email limit', async () => {
    const seen: string[] = [];
    const { handler, initialize } = make({
      limiter: {
        consume: async (policy) => {
          seen.push(policy.name);
          return { allowed: false, retryAfterSeconds: 42 };
        },
      },
    });
    const res = await handler(post(body()));
    expect(res.status).toBe(429);
    expect(res.headers.get('retry-after')).toBe('42');
    expect(seen).toEqual(['donate-ip']);
    expect(initialize).not.toHaveBeenCalled();

    const names: string[] = [];
    const email = make({ limiter: { consume: async (p) => (names.push(p.name), { allowed: p.name !== 'donate-email', retryAfterSeconds: 9 }) } });
    expect((await email.handler(post(body()))).status).toBe(429);
    expect(names).toEqual(['donate-ip', 'donate-email']);
  });

  it('fails closed with 429 when the limiter store is down', async () => {
    const { handler, initialize } = make({ limiter: { consume: async () => { throw new Error('down'); } } });
    expect((await handler(post(body()))).status).toBe(429);
    expect(initialize).not.toHaveBeenCalled();
  });

  it('limits by a hash of the email, never the address', async () => {
    const subjects: string[] = [];
    const { handler } = make({ limiter: { consume: async (_p, subject) => (subjects.push(subject), { allowed: true, retryAfterSeconds: 0 }) } });
    await handler(post(body()));
    expect(subjects.some((s) => s.includes('donor@example.com'))).toBe(false);
    expect(subjects).toHaveLength(2);
  });

  it('creates one pending row and returns an https paystack url, for a guest with no session', async () => {
    const { handler, created, initialize } = make();
    const res = await handler(post(body()));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.url).toMatch(/^https:\/\//);
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(created).toHaveLength(1);
    expect(created[0]).toMatchObject({ amountMinor: 100000, currency: 'NGN', kind: 'one_time', siteMode: 'test', accountId: null, attemptKey: ATTEMPT });
    const call = initialize.mock.calls[0]![0];
    expect(call).toMatchObject({ amountMinor: 100000, currency: 'NGN', email: 'donor@example.com' });
    expect(call.reference).toMatch(/^ad-don-[a-z0-9]{20}$/);
  });

  it('sends a callback url with the reference and a valid receipt token, and no name or email in metadata', async () => {
    const { handler, initialize } = make();
    await handler(post(body()));
    const call = initialize.mock.calls[0]![0];
    const cb = new URL(call.callbackUrl);
    expect(cb.origin + cb.pathname).toBe(`${ORIGIN}/donate/thank-you`);
    expect(cb.searchParams.get('reference')).toBe(call.reference);
    expect(verifyReceiptToken(receiptSecret, call.reference, cb.searchParams.get('t'))).toBe(true);
    expect(JSON.stringify(call.metadata ?? {})).not.toMatch(/Chidi|donor@example/);
  });

  it('seals the email and name and stores only a hash for lookups', async () => {
    const { handler, created } = make();
    await handler(post(body()));
    const row = created[0]!;
    const sealedEmail = row.emailEnc as Uint8Array;
    expect(Buffer.from(sealedEmail).includes('donor@example.com')).toBe(false);
    expect(Buffer.from(row.nameEnc as Uint8Array).includes('Chidi')).toBe(false);
    expect((row.emailHash as Uint8Array).length).toBe(32);
  });

  it('links the signed in account only from the server side session', async () => {
    const { handler, created } = make({ resolveViewer: async () => ({ audience: 'general', accountId: 'acc-1' }) });
    await handler(post(body({})));
    expect(created[0]!.accountId).toBe('acc-1');
  });

  it('does not store anything when Paystack initialize fails and says nothing was charged', async () => {
    const { handler, created } = make({
      provider: { name: 'paystack', initialize: async () => { throw new PaymentError('network', 'boom', true); }, verify: async () => { throw new Error('unused'); } },
    });
    const res = await handler(post(body()));
    expect(res.status).toBe(502);
    expect((await res.json()).error).toBe('provider');
    expect(created).toEqual([]);
  });

  it('answers a repeated attempt with the first url and calls Paystack once', async () => {
    const { handler, initialize } = make({
      store: { findAttempt: async () => ({ reference: 'ad-don-aaaaaaaaaaaaaaaaaaaa', url: 'https://checkout.paystack.com/first' }), create: async () => { throw new Error('unused'); } },
    });
    const res = await handler(post(body()));
    expect((await res.json()).url).toBe('https://checkout.paystack.com/first');
    expect(initialize).not.toHaveBeenCalled();
  });

  it('returns the winner url when two taps race and the database keeps the first', async () => {
    const { handler } = make({
      store: { findAttempt: async () => null, create: async () => ({ reference: 'ad-don-bbbbbbbbbbbbbbbbbbbb', url: 'https://checkout.paystack.com/winner', created: false }) },
    });
    expect((await (await handler(post(body()))).json()).url).toBe('https://checkout.paystack.com/winner');
  });

  it('refuses a provider url that is not https', async () => {
    const { handler, created } = make({
      provider: { name: 'paystack', initialize: async (i) => ({ authorizationUrl: 'http://evil.example/x', accessCode: 'a', reference: i.reference }), verify: async () => { throw new Error('unused'); } },
    });
    expect((await handler(post(body()))).status).toBe(502);
    expect(created).toEqual([]);
  });

  it('accepts USD only when enabled and inside its limits', async () => {
    const usd = make({ config: async () => ({ enabled: true, currencies: ['NGN', 'USD'], usdEnabled: true, monthlyEnabled: false, limits: { NGN: { min: 20000, max: 500000000 }, USD: { min: 100, max: 5000000 } } }) });
    expect((await usd.handler(post(body({ currency: 'USD', amountMinor: 1000 })))).status).toBe(200);
    expect((await usd.handler(post(body({ currency: 'USD', amountMinor: 99, attemptId: '0190a000-0000-7000-8000-000000000002' })))).status).toBe(400);
  });

  it('never logs or returns the secret, the email or a stack in an error', async () => {
    const warn = vi.fn();
    const { handler } = make({
      warn,
      provider: { name: 'paystack', initialize: async () => { throw new PaymentError('server', 'sk_test_abc donor@example.com', true); }, verify: async () => { throw new Error('unused'); } },
    });
    const res = await handler(post(body()));
    const text = JSON.stringify(await res.json()) + JSON.stringify(warn.mock.calls);
    expect(text).not.toMatch(/sk_test|donor@example/);
  });
});
