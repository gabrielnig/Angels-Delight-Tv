import { verifyReceiptToken, type Currency, type PaymentProvider, isValidReference } from '@ad/payments';
import { clientIp, truncateIp, type BucketPolicy, type LimitResult, type TrustedProxyMode } from '@ad/security';
import { isGeneralAudience } from '@ad/sponsors';

export interface StatusRow {
  status: 'pending' | 'succeeded' | 'failed' | 'abandoned' | 'refunded' | 'needs_review';
  kind: 'one_time' | 'monthly';
  currency: Currency;
  amountMinor: number;
  paidAt: Date | null;
}

export type DonationView = 'succeeded' | 'processing' | 'failed' | 'cancelled';

export interface StatusDeps {
  enabled(): Promise<boolean>;
  provider: PaymentProvider | null;
  resolveViewer(request: Request): Promise<{ audience: unknown }>;
  limiter: { consume(policy: BucketPolicy, subject: string): Promise<Pick<LimitResult, 'allowed' | 'retryAfterSeconds'>> };
  lookup(reference: string): Promise<StatusRow | null>;
  receiptSecret: Uint8Array;
  trustedProxyMode: TrustedProxyMode;
}

const policy = (name: string, capacity: number, minutes: number): BucketPolicy => ({ name, capacity, refillPerSecond: capacity / (minutes * 60) });
export const STATUS_IP_POLICY = policy('donate-status-ip', 60, 5);
export const STATUS_REF_POLICY = policy('donate-status-ref', 20, 5);

const headers = (extra: Record<string, string> = {}) => ({ 'content-type': 'application/json', 'cache-control': 'no-store', ...extra });
const notFound = () => new Response(JSON.stringify({ error: 'not_found' }), { status: 404, headers: headers() });

/** What the donor is shown for a stored state. Anything unclear reads as processing, never as paid. */
export function viewOf(status: StatusRow['status']): DonationView | 'pending' {
  switch (status) {
    case 'succeeded':
    case 'refunded':
      return 'succeeded';
    case 'failed':
      return 'failed';
    case 'abandoned':
      return 'cancelled';
    case 'needs_review':
      return 'processing';
    default:
      return 'pending';
  }
}

/**
 * GET /api/donate/status?reference=&t= (M48-S29). The only source of "succeeded" is our database, which the
 * verified webhook updates. For a gift still pending we ask Paystack (amount and currency from our own row) only to
 * tell failed or cancelled apart from "still confirming". A paid answer never shows as paid here. Personal facts
 * (amount, kind, reference) need the signed receipt token; without it only the state is returned.
 */
export function createStatusHandler(deps: StatusDeps) {
  return async (request: Request): Promise<Response> => {
    if (!(await deps.enabled().catch(() => false))) return new Response(null, { status: 404, headers: { 'cache-control': 'no-store' } });
    try {
      if (!isGeneralAudience((await deps.resolveViewer(request)).audience)) {
        return new Response(JSON.stringify({ error: 'kids' }), { status: 403, headers: headers() });
      }
    } catch {
      return new Response(JSON.stringify({ error: 'kids' }), { status: 403, headers: headers() });
    }

    const ip = clientIp(request.headers, deps.trustedProxyMode);
    try {
      const verdict = await deps.limiter.consume(STATUS_IP_POLICY, (ip ? truncateIp(ip) : null) ?? 'unknown');
      if (!verdict.allowed) {
        return new Response(JSON.stringify({ error: 'rate_limited' }), { status: 429, headers: headers({ 'retry-after': String(verdict.retryAfterSeconds || 30) }) });
      }
    } catch {
      return new Response(JSON.stringify({ error: 'rate_limited' }), { status: 429, headers: headers({ 'retry-after': '30' }) });
    }

    const params = new URL(request.url).searchParams;
    const reference = params.get('reference');
    if (!isValidReference(reference)) return notFound();
    const row = await deps.lookup(reference).catch(() => null);
    if (!row) return notFound();

    let state = viewOf(row.status);
    if (state === 'pending') {
      state = 'processing';
      const provider = deps.provider;
      const allowed = provider
        ? await deps.limiter.consume(STATUS_REF_POLICY, reference).then((v) => v.allowed, () => false)
        : false;
      if (provider && allowed) {
        try {
          const verdict = await provider.verify(reference, { amountMinor: row.amountMinor, currency: row.currency });
          if (verdict.status === 'failed') state = 'failed';
          else if (verdict.status === 'abandoned') state = 'cancelled';
        } catch {
          // Paystack is unreachable or confused: keep saying processing.
        }
      }
    }

    const body: Record<string, unknown> = { status: state };
    if (verifyReceiptToken(deps.receiptSecret, reference, params.get('t'))) {
      body.reference = reference;
      body.amountMinor = row.amountMinor;
      body.currency = row.currency;
      body.kind = row.kind;
    }
    return new Response(JSON.stringify(body), { status: 200, headers: headers() });
  };
}
