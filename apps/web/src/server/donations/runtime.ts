import 'server-only';
import { createPaystackProvider, type PaymentProvider } from '@ad/payments';
import { RateLimiter } from '@ad/security';
import { uuidv7 } from '@ad/shared';
import { sql } from 'drizzle-orm';
import { themeRuntime } from '../../lib/data/admin/theme-runtime';
import { resolveViewer } from '../../lib/data/analytics-viewer';
import { getServices } from '../../lib/runtime/services';
import { realDataEnabled } from '../data/mode';
import { installRealViewerResolver } from '../viewer/install-analytics';
import { viewerRuntime } from '../viewer/runtime';
import { createCheckoutHandler, type DonateConfig, type DonationCheckoutStore } from './checkout';
import { createStatusHandler, type StatusRow } from './status';

const rowsOf = <T>(result: unknown): T[] => {
  const r = (result as { rows?: unknown } | null)?.rows;
  return Array.isArray(r) ? (r as T[]) : Array.isArray(result) ? (result as T[]) : [];
};

/** USD has no setting yet: one dollar up to fifty thousand dollars, in cents. */
const USD_LIMITS = { min: 100, max: 5_000_000 };

export async function readDonateConfig(): Promise<DonateConfig> {
  const s = (await themeRuntime()).settings;
  const [enabled, currencies, usd, monthly, min, max] = await Promise.all([
    s.get('donate.enabled'),
    s.get('donate.currencies'),
    s.get('donate.usd.enabled'),
    s.get('donate.monthly.enabled'),
    s.get('donate.min_minor.ngn'),
    s.get('donate.max_minor.ngn'),
  ]);
  return {
    enabled,
    currencies,
    usdEnabled: usd,
    monthlyEnabled: monthly,
    limits: { NGN: { min, max }, USD: USD_LIMITS },
  };
}

/** Both the Paystack key and the receipt token secret must be set, or the donate routes do not exist. */
export function donateProvider(): { provider: PaymentProvider; receiptSecret: Uint8Array } | null {
  const { env } = getServices();
  if (!env.PAYSTACK_SECRET_KEY || !env.DONATE_RECEIPT_TOKEN_SECRET) return null;
  return {
    provider: createPaystackProvider({ secretKey: env.PAYSTACK_SECRET_KEY, baseUrl: env.PAYSTACK_BASE_URL }),
    receiptSecret: env.DONATE_RECEIPT_TOKEN_SECRET,
  };
}

const viewerFor = async (request: Request) => {
  installRealViewerResolver();
  const viewer = await resolveViewer(request);
  let accountId: string | null = null;
  if (realDataEnabled()) {
    try {
      accountId = (await viewerRuntime().resolveActor(request))?.accountId ?? null;
    } catch {
      accountId = null;
    }
  }
  return { audience: viewer.audience as unknown, accountId };
};

function checkoutStore(): DonationCheckoutStore {
  const { db } = getServices();
  return {
    async findAttempt(key) {
      const r = rowsOf<{ reference: string; checkout_url: string }>(await db.execute(sql`SELECT * FROM donation_by_attempt(${key})`))[0];
      return r ? { reference: r.reference, url: r.checkout_url } : null;
    },
    async create(i) {
      const r = rowsOf<{ reference: string; checkout_url: string; created: boolean }>(
        await db.execute(sql`
          SELECT * FROM donation_create(${i.id}::uuid, ${i.reference}, ${i.attemptKey}, ${i.kind}, ${i.currency}, ${i.amountMinor}::bigint,
            ${Buffer.from(i.emailEnc)}, ${Buffer.from(i.emailHash)}, ${i.nameEnc ? Buffer.from(i.nameEnc) : null}, ${i.anonymous},
            ${i.siteMode}, ${i.accountId}::uuid, ${i.checkoutUrl})`),
      )[0];
      if (!r) throw new Error('donation was not created');
      return { reference: r.reference, url: r.checkout_url, created: r.created };
    },
  };
}

export function donateCheckout() {
  const services = getServices();
  const configured = donateProvider();
  return createCheckoutHandler({
    config: readDonateConfig,
    provider: configured?.provider ?? null,
    resolveViewer: viewerFor,
    limiter: new RateLimiter(services.db),
    store: checkoutStore(),
    kek: services.env.FIELD_KEK,
    pepper: services.env.EMAIL_HASH_PEPPER,
    receiptSecret: configured?.receiptSecret ?? new Uint8Array(32),
    appOrigin: services.env.APP_ORIGIN,
    trustedProxyMode: services.env.TRUSTED_PROXY_MODE,
    siteMode: services.env.PAYSTACK_SECRET_KEY?.startsWith('sk_live_') ? 'live' : 'test',
    newId: uuidv7,
    warn: (message, fields) => services.logger.warn(message, fields),
  });
}

export async function lookupDonation(reference: string): Promise<StatusRow | null> {
  const r = rowsOf<{ status: StatusRow['status']; kind: StatusRow['kind']; currency: StatusRow['currency']; amount_minor: string | number; paid_at: Date | string | null }>(
    await getServices().db.execute(sql`SELECT * FROM donation_public_status(${reference})`),
  )[0];
  if (!r) return null;
  return {
    status: r.status,
    kind: r.kind,
    currency: r.currency,
    amountMinor: Number(r.amount_minor),
    paidAt: r.paid_at ? new Date(r.paid_at) : null,
  };
}

export function donateStatus() {
  const services = getServices();
  const configured = donateProvider();
  return createStatusHandler({
    enabled: async () => configured !== null && (await readDonateConfig()).enabled,
    provider: configured?.provider ?? null,
    resolveViewer: viewerFor,
    limiter: new RateLimiter(services.db),
    lookup: lookupDonation,
    receiptSecret: configured?.receiptSecret ?? new Uint8Array(32),
    trustedProxyMode: services.env.TRUSTED_PROXY_MODE,
  });
}
