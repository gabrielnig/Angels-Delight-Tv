import { isMinorAmount, type Currency } from './money';
import {
  PaymentError,
  type ExpectedPayment,
  type InitializeInput,
  type InitializeResult,
  type PaymentProvider,
  type VerifyResult,
} from './provider';
import { isValidReference } from './reference';

export interface PaystackOptions {
  secretKey: string;
  baseUrl: string;
  fetch?: typeof globalThis.fetch;
  timeoutMs?: number;
}

const CURRENCIES = new Set<string>(['NGN', 'USD']);
const isCurrency = (value: unknown): value is Currency => typeof value === 'string' && CURRENCIES.has(value);

/**
 * The Paystack adapter. It only calls initialize and verify, over https with the secret key in the
 * Authorization header, and the donor leaves our site for Paystack's hosted page, so no card detail ever
 * reaches us. Errors carry fixed text and never the key.
 */
export function createPaystackProvider(options: PaystackOptions): PaymentProvider {
  if (!options.secretKey) throw new Error('PAYSTACK_SECRET_KEY is required to build the Paystack provider');
  const base = options.baseUrl.replace(/\/+$/, '');
  const doFetch = options.fetch ?? globalThis.fetch;
  const timeoutMs = options.timeoutMs ?? 10_000;
  const scrub = (text: string) => text.split(options.secretKey).join('[key]');

  async function call(method: 'GET' | 'POST', path: string, body?: Record<string, unknown>): Promise<Record<string, unknown>> {
    let response: Response;
    try {
      response = await doFetch(`${base}${path}`, {
        method,
        headers: {
          authorization: `Bearer ${options.secretKey}`,
          'content-type': 'application/json',
          accept: 'application/json',
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (error) {
      const name = (error as { name?: string } | null)?.name;
      if (name === 'TimeoutError' || name === 'AbortError') {
        throw new PaymentError('timeout', 'Paystack did not answer in time', true);
      }
      throw new PaymentError('network', 'Could not reach Paystack', true);
    }
    const status = response.status;
    let payload: unknown = null;
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }
    const message =
      payload && typeof payload === 'object' && typeof (payload as { message?: unknown }).message === 'string'
        ? scrub((payload as { message: string }).message).slice(0, 200)
        : '';
    if (status === 401 || status === 403) throw new PaymentError('unauthorized', 'Paystack refused the key', false, status);
    if (status === 429) throw new PaymentError('rate_limited', 'Paystack asked us to slow down', true, status);
    if (status >= 500) throw new PaymentError('server', 'Paystack had a problem', true, status);
    if (status >= 400) throw new PaymentError('rejected', `Paystack rejected the request${message ? `: ${message}` : ''}`, false, status);
    if (!payload || typeof payload !== 'object' || (payload as { status?: unknown }).status !== true) {
      throw new PaymentError('bad_response', 'Paystack sent an answer we could not read', false, status);
    }
    return payload as Record<string, unknown>;
  }

  return {
    name: 'paystack',

    async initialize(input: InitializeInput): Promise<InitializeResult> {
      if (!isMinorAmount(input.amountMinor)) throw new PaymentError('rejected', 'The amount must be a whole number of kobo or cents', false);
      if (!isValidReference(input.reference)) throw new PaymentError('rejected', 'The reference is not valid', false);
      const body: Record<string, unknown> = {
        email: input.email,
        amount: input.amountMinor,
        currency: input.currency,
        reference: input.reference,
        callback_url: input.callbackUrl,
        metadata: JSON.stringify(input.metadata ?? {}),
        ...(input.planCode ? { plan: input.planCode } : {}),
      };
      const out = await call('POST', '/transaction/initialize', body);
      const data = (out.data ?? {}) as Record<string, unknown>;
      const { authorization_url: url, access_code: code, reference } = data;
      if (typeof url !== 'string' || !url.startsWith('https://') || typeof code !== 'string' || typeof reference !== 'string') {
        throw new PaymentError('bad_response', 'Paystack sent an answer we could not read', false);
      }
      return { authorizationUrl: url, accessCode: code, reference };
    },

    async verify(reference: string, expected: ExpectedPayment): Promise<VerifyResult> {
      if (!isValidReference(reference)) throw new PaymentError('rejected', 'The reference is not valid', false);
      const out = await call('GET', `/transaction/verify/${encodeURIComponent(reference)}`);
      const data = (out.data ?? {}) as Record<string, unknown>;
      const status = data.status;
      if (status === 'failed' || status === 'abandoned') return { status, reference };
      if (status !== 'success') return { status: 'pending', reference };
      const amount = data.amount;
      const currency = data.currency;
      if (!isMinorAmount(amount) || typeof currency !== 'string') {
        throw new PaymentError('bad_response', 'Paystack sent an answer we could not read', false);
      }
      if (!isCurrency(currency) || currency !== expected.currency) {
        return { status: 'needs_review', reference, reason: 'currency_mismatch', amountMinor: amount, currency };
      }
      if (amount < expected.amountMinor) {
        return { status: 'needs_review', reference, reason: 'amount_lower', amountMinor: amount, currency };
      }
      const paid = typeof data.paid_at === 'string' ? new Date(data.paid_at) : null;
      return {
        status: 'paid',
        reference,
        amountMinor: amount,
        currency,
        paidAt: paid && !Number.isNaN(paid.getTime()) ? paid : null,
      };
    },
  };
}
