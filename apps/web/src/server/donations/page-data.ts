import 'server-only';
import type { Currency } from '@ad/payments/money';
import { themeRuntime } from '../../lib/data/admin/theme-runtime';
import { getSession } from '../../lib/session';
import { currentGuestAudience } from '../guest/guest-view';
import { getServices } from '../../lib/runtime/services';
import { donateAvailable } from './availability';
import { decideDonateGate, type DonateGate } from './gate';
import { readDonateConfig } from './runtime';
import type { TransparencyItem } from '../../components/donate/TransparencyList';

/** Whether this visitor is on a kids profile or a kids guest device. Signed in with no profile counts as general. */
async function isKids(): Promise<boolean> {
  const session = await getSession();
  if (session) return session.profile?.kids === true;
  return (await currentGuestAudience()) === 'kids';
}

export async function currentDonateGate(): Promise<DonateGate> {
  const available = await donateAvailable();
  if (!available) return 'off';
  try {
    return decideDonateGate({ available, kids: await isKids() });
  } catch {
    // Any doubt about the audience means the kids answer.
    return 'kids';
  }
}

export interface TransparencyData {
  title: string;
  intro: string;
  items: TransparencyItem[];
  updatedAt: string | null;
}

async function transparencyOn(): Promise<boolean> {
  try {
    return await (await themeRuntime()).settings.get('donate.transparency.enabled');
  } catch {
    return false;
  }
}

/** The transparency page follows the donate rules for kids (R25): off is a 404, a kids audience is asked to find a grown-up. */
export async function currentTransparencyGate(): Promise<DonateGate> {
  const enabled = await transparencyOn();
  if (!enabled) return 'off';
  try {
    return decideDonateGate({ available: true, kids: await isKids() });
  } catch {
    return 'kids';
  }
}

export async function readTransparency(): Promise<TransparencyData> {
  const s = (await themeRuntime()).settings;
  const [title, intro, items, updatedAt] = await Promise.all([
    s.get('donate.transparency.title'),
    s.get('donate.transparency.intro'),
    s.get('donate.transparency.items'),
    s.get('donate.transparency.updated_at'),
  ]);
  return { title, intro, items, updatedAt };
}

export interface DonatePageData {
  currencies: Currency[];
  presets: Record<Currency, number[]>;
  limits: Record<Currency, { min: number; max: number }>;
  monthlyEnabled: boolean;
  orgName: string;
  testMode: boolean;
  introTitle: string;
  introBody: string;
  thankYouTitle: string;
  thankYouBody: string;
  transparencyEnabled: boolean;
}

export async function readDonatePage(): Promise<DonatePageData> {
  const s = (await themeRuntime()).settings;
  const config = await readDonateConfig();
  const [ngn, usd, orgName, introTitle, introBody, thankYouTitle, thankYouBody, transparency] = await Promise.all([
    s.get('donate.presets_minor.ngn'),
    s.get('donate.presets_minor.usd'),
    s.get('donate.org_name'),
    s.get('donate.intro_title'),
    s.get('donate.intro_body'),
    s.get('donate.thank_you_title'),
    s.get('donate.thank_you_body'),
    s.get('donate.transparency.enabled'),
  ]);
  const currencies = config.currencies.filter((c) => c === 'NGN' || config.usdEnabled);
  return {
    currencies: currencies.length > 0 ? currencies : ['NGN'],
    presets: { NGN: ngn, USD: usd },
    limits: config.limits,
    // Monthly giving is built in slice 10. Until then the form never offers it.
    monthlyEnabled: false,
    orgName,
    testMode: !getServices().env.PAYSTACK_SECRET_KEY?.startsWith('sk_live_'),
    introTitle,
    introBody,
    thankYouTitle,
    thankYouBody,
    transparencyEnabled: transparency,
  };
}
