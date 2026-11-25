import { normalizeEmail } from '@ad/auth';
import {
  PaymentError,
  checkAmount,
  donorEmailHash,
  issueReceiptToken,
  newReference,
  sealDonorField,
  type Currency,
  type PaymentProvider,
} from '@ad/payments';
import { assertSameOrigin, clientIp, truncateIp, type BucketPolicy, type LimitResult, type TrustedProxyMode } from '@ad/security';
import { isGeneralAudience } from '@ad/sponsors';
import { z } from 'zod';

export interface DonateConfig {
  enabled: boolean;
  currencies: Currency[];
  usdEnabled: boolean;
  monthlyEnabled: boolean;
  limits: Record<Currency, { min: number; max: number }>;
}

export interface NewDonation {
  id: string;
  reference: string;
  attemptKey: string;
  kind: 'one_time' | 'monthly';
  currency: Currency;
  amountMinor: number;
  emailEnc: Uint8Array;
  emailHash: Uint8Array;
  nameEnc: Uint8Array | null;
  anonymous: boolean;
  siteMode: 'test' | 'live';
  accountId: string | null;
  checkoutUrl: string;
}

export interface DonationCheckoutStore {
  findAttempt(attemptKey: string): Promise<{ reference: string; url: string } | null>;
  /** Inserts a pending row, or returns the row the same attempt key made first (`created: false`). */
  create(input: NewDonation): Promise<{ reference: string; url: string; created: boolean }>;
}

export interface CheckoutDeps {
  config(): Promise<DonateConfig>;
  /** Null when no Paystack key is set: the route then does not exist. */
  provider: PaymentProvider | null;
  resolveViewer(request: Request): Promise<{ audience: unknown; accountId: string | null }>;
  limiter: { consume(policy: BucketPolicy, subject: string): Promise<Pick<LimitResult, 'allowed' | 'retryAfterSeconds'>> };
  store: DonationCheckoutStore;
  kek: Uint8Array;
  pepper: Uint8Array;
  receiptSecret: Uint8Array;
  appOrigin: string;
  trustedProxyMode: TrustedProxyMode;
  siteMode: 'test' | 'live';
  newId(): string;
  warn?(message: string, fields?: Record<string, unknown>): void;
}

const perMinutes = (name: string, capacity: number, minutes: number): BucketPolicy => ({
  name,
  capacity,
  refillPerSecond: capacity / (minutes * 60),
});
/** Card testing protection (M48-S43): few attempts per address, fewer per donor email. */
export const DONATE_IP_POLICY = perMinutes('donate-ip', 10, 15);
export const DONATE_EMAIL_POLICY = perMinutes('donate-email', 5, 60);

const MAX_BODY = 2048;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const schema = z
  .object({
    amountMinor: z.number().int().safe(),
    currency: z.enum(['NGN', 'USD']),
    email: z.string().max(254),
    name: z.string().max(80).optional(),
    attemptId: z.string().regex(UUID),
    kind: z.enum(['one_time', 'monthly']).default('one_time'),
  })
  .strict();

const json = (status: number, data: unknown, extra: Record<string, string> = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store', ...extra },
  });
const bad = (error: string, field?: string) => json(400, { error, ...(field ? { field } : {}) });
// eslint-disable-next-line no-control-regex -- stripping control characters is the purpose of this pattern
const cleanName = (name: string | undefined) => (name ?? '').replace(/[\u0000-\u001f\u007f<>]/g, '').replace(/\s+/g, ' ').trim();

export const PROVIDER_MESSAGE = 'We could not start the payment. Nothing was charged. Try again.';

/**
 * POST /api/donate/checkout (M48-S25, S26, S33, S34, S43). Order matters: the route is absent when off, kids are
 * refused before anything is read, the address limit runs before the body is parsed, and the amount is checked
 * against the server's own limits (the browser's number is only a request). Paystack is called first and a row is
 * stored only after it answered, so a failed start leaves nothing behind. The donor then goes to Paystack's hosted
 * page, so no card detail reaches us.
 */
export function createCheckoutHandler(deps: CheckoutDeps) {
  return async (request: Request): Promise<Response> => {
    const provider = deps.provider;
    let config: DonateConfig;
    try {
      config = await deps.config();
    } catch {
      return new Response(null, { status: 404, headers: { 'cache-control': 'no-store' } });
    }
    if (!provider || !config.enabled) return new Response(null, { status: 404, headers: { 'cache-control': 'no-store' } });

    let viewer: Awaited<ReturnType<CheckoutDeps['resolveViewer']>>;
    try {
      viewer = await deps.resolveViewer(request);
    } catch {
      return json(403, { error: 'kids' });
    }
    if (!isGeneralAudience(viewer.audience)) return json(403, { error: 'kids' });

    try {
      assertSameOrigin(request.headers, deps.appOrigin);
    } catch {
      return json(403, { error: 'origin' });
    }

    const ip = clientIp(request.headers, deps.trustedProxyMode);
    const limited = (retry: number) => json(429, { error: 'rate_limited' }, { 'retry-after': String(retry || 60) });
    try {
      const verdict = await deps.limiter.consume(DONATE_IP_POLICY, (ip ? truncateIp(ip) : null) ?? 'unknown');
      if (!verdict.allowed) return limited(verdict.retryAfterSeconds);
    } catch {
      return limited(60);
    }

    const text = await request.text().catch(() => '');
    if (!text || text.length > MAX_BODY) return bad('invalid');
    let raw: unknown;
    try {
      raw = JSON.parse(text);
    } catch {
      return bad('invalid');
    }
    const parsed = schema.safeParse(raw);
    if (!parsed.success) return bad('invalid');
    const input = parsed.data;
    const email = normalizeEmail(input.email);
    if (!email) return bad('invalid', 'email');

    if (!config.currencies.includes(input.currency) || (input.currency === 'USD' && !config.usdEnabled)) {
      return bad('currency', 'currency');
    }
    // Monthly giving arrives with slice 10. Until then it is refused even if the switch is on.
    if (input.kind === 'monthly') return bad('monthly', 'kind');
    const amount = checkAmount(input.amountMinor, config.limits[input.currency]);
    if (!amount.ok) return bad(amount.reason === 'below_min' ? 'amount_low' : 'amount_high', 'amount');

    const emailHash = donorEmailHash(deps.pepper, email);
    try {
      const verdict = await deps.limiter.consume(DONATE_EMAIL_POLICY, Buffer.from(emailHash).toString('hex'));
      if (!verdict.allowed) return limited(verdict.retryAfterSeconds);
    } catch {
      return limited(60);
    }

    try {
      const first = await deps.store.findAttempt(input.attemptId);
      if (first) return json(200, { url: first.url });
    } catch {
      return json(502, { error: 'provider', message: PROVIDER_MESSAGE });
    }

    const reference = newReference();
    let checkoutUrl: string;
    try {
      const callback = new URL('/donate/thank-you', deps.appOrigin);
      callback.searchParams.set('reference', reference);
      callback.searchParams.set('t', issueReceiptToken(deps.receiptSecret, reference));
      const started = await provider.initialize({
        amountMinor: input.amountMinor,
        currency: input.currency,
        email,
        reference,
        callbackUrl: callback.toString(),
        metadata: { source: 'angels-delight-tv', kind: input.kind },
      });
      if (!/^https:\/\//.test(started.authorizationUrl)) throw new PaymentError('bad_response', 'not https', false);
      checkoutUrl = started.authorizationUrl;
    } catch (error) {
      // The code only. The message, the donor and the key are never logged.
      deps.warn?.('donation checkout did not start', { code: error instanceof PaymentError ? error.code : 'unknown' });
      return json(502, { error: 'provider', message: PROVIDER_MESSAGE });
    }

    try {
      const id = deps.newId();
      const name = cleanName(input.name);
      const stored = await deps.store.create({
        id,
        reference,
        attemptKey: input.attemptId,
        kind: input.kind,
        currency: input.currency,
        amountMinor: input.amountMinor,
        emailEnc: sealDonorField(deps.kek, id, 'email', email),
        emailHash,
        nameEnc: name ? sealDonorField(deps.kek, id, 'name', name) : null,
        anonymous: false,
        siteMode: deps.siteMode,
        accountId: viewer.accountId,
        checkoutUrl,
      });
      return json(200, { url: stored.url });
    } catch {
      deps.warn?.('donation checkout was not stored');
      return json(502, { error: 'provider', message: PROVIDER_MESSAGE });
    }
  };
}
