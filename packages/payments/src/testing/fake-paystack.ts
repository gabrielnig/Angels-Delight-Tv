import { createHmac } from 'node:crypto';

type Status = 'success' | 'failed' | 'abandoned' | 'ongoing';
interface Transaction {
  amount: number;
  currency: string;
  email: string;
  status: Status;
  paidAt: string | null;
  metadata: unknown;
  planCode?: string;
}
export interface FakeCall {
  method: string;
  path: string;
  headers: Record<string, string>;
  body: Record<string, unknown> | null;
}

const REFERENCE = /^[A-Za-z0-9.=-]{1,100}$/;
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

/**
 * An in memory stand in for the parts of the Paystack API the app uses: initialize and verify. It checks the
 * bearer key, the reference characters and that the amount is a whole number, like the real service. It is a
 * fetch function, so no port is opened.
 */
export function createFakePaystack(options: { secretKey?: string } = {}) {
  const secretKey = options.secretKey ?? 'sk_test_fake';
  const calls: FakeCall[] = [];
  const transactions = new Map<string, Transaction>();
  const failures: Array<'network' | 'timeout' | 'server' | 'rate_limited' | 'garbage'> = [];

  const fetch = async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
    const headers: Record<string, string> = {};
    new Headers(init?.headers).forEach((value, key) => {
      headers[key.toLowerCase()] = value;
    });
    const method = (init?.method ?? 'GET').toUpperCase();
    const body = typeof init?.body === 'string' ? (JSON.parse(init.body) as Record<string, unknown>) : null;
    calls.push({ method, path: url.pathname, headers, body });

    const failure = failures.shift();
    if (failure === 'network') throw new TypeError('fetch failed');
    if (failure === 'timeout') throw Object.assign(new Error('The operation was aborted'), { name: 'TimeoutError' });
    if (failure === 'server') return json(503, { status: false, message: 'Service unavailable' });
    if (failure === 'rate_limited') return json(429, { status: false, message: 'Too many requests' });
    if (failure === 'garbage') return new Response('<html>oops</html>', { status: 200 });

    if (headers.authorization !== `Bearer ${secretKey}`) {
      return json(401, { status: false, message: 'Invalid key' });
    }

    if (method === 'POST' && url.pathname === '/transaction/initialize') {
      const { email, amount, currency, reference, metadata } = body ?? {};
      if (typeof email !== 'string' || !email.includes('@')) return json(400, { status: false, message: 'Invalid Email Address Passed' });
      if (typeof amount !== 'number' || !Number.isInteger(amount) || amount <= 0) return json(400, { status: false, message: 'Invalid Amount Passed' });
      if (typeof reference !== 'string' || !REFERENCE.test(reference)) return json(400, { status: false, message: 'Invalid reference' });
      if (transactions.has(reference)) return json(400, { status: false, message: 'Duplicate Transaction Reference' });
      transactions.set(reference, {
        amount,
        currency: typeof currency === 'string' ? currency : 'NGN',
        email,
        status: 'ongoing',
        paidAt: null,
        metadata,
        ...(typeof body?.plan === 'string' ? { planCode: body.plan } : {}),
      });
      const accessCode = `ac_${reference.slice(-10)}`;
      return json(200, {
        status: true,
        message: 'Authorization URL created',
        data: { authorization_url: `https://checkout.paystack.test/${accessCode}`, access_code: accessCode, reference },
      });
    }

    const verify = /^\/transaction\/verify\/([^/]+)$/.exec(url.pathname);
    if (method === 'GET' && verify) {
      const reference = decodeURIComponent(verify[1]!);
      const tx = transactions.get(reference);
      if (!tx) return json(404, { status: false, message: 'Transaction reference not found' });
      return json(200, {
        status: true,
        message: 'Verification successful',
        data: { status: tx.status, reference, amount: tx.amount, currency: tx.currency, paid_at: tx.paidAt, metadata: tx.metadata },
      });
    }
    return json(404, { status: false, message: 'Not found' });
  };

  return {
    fetch: fetch as typeof globalThis.fetch,
    calls,
    transactions,
    secretKey,
    /** Marks a transaction as the customer finishing, failing or leaving the checkout page. */
    settle(reference: string, status: Status, patch: Partial<Pick<Transaction, 'amount' | 'currency' | 'paidAt'>> = {}) {
      const tx = transactions.get(reference);
      if (!tx) throw new Error(`unknown reference ${reference}`);
      Object.assign(tx, { status, paidAt: status === 'success' ? (patch.paidAt ?? '2027-01-05T10:00:00.000Z') : null }, patch.amount ? { amount: patch.amount } : {}, patch.currency ? { currency: patch.currency } : {});
    },
    /** The next call fails in the given way, then calls work again. */
    failNext(kind: 'network' | 'timeout' | 'server' | 'rate_limited' | 'garbage', times = 1) {
      for (let i = 0; i < times; i += 1) failures.push(kind);
    },
  };
}

/** The signature Paystack would put on a webhook body, for webhook tests. */
export function signWebhookBody(rawBody: string | Uint8Array, secretKey: string): string {
  return createHmac('sha512', secretKey).update(rawBody).digest('hex');
}

/** A `charge.success` webhook body shaped like the real one (no event id exists). */
export function chargeSuccessBody(input: {
  reference: string;
  amount: number;
  currency?: string;
  paidAt?: string;
  email?: string;
}): string {
  return JSON.stringify({
    event: 'charge.success',
    data: {
      id: 302961,
      status: 'success',
      reference: input.reference,
      amount: input.amount,
      currency: input.currency ?? 'NGN',
      paid_at: input.paidAt ?? '2027-01-05T10:00:00.000Z',
      customer: { email: input.email ?? 'donor@example.com' },
    },
  });
}
