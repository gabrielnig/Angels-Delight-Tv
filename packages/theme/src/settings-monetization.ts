import { z } from 'zod';

/**
 * Settings for module M48 (sponsors and donations). Every switch ships off. Client inputs (organisation name,
 * registration, bank details, copy, amounts) default to empty or neutral draft text and are never hardcoded
 * elsewhere (rulings R02, R25). Secrets (the Paystack key) are environment variables, never settings.
 */

const FORBIDDEN_TEXT = /[\u2013\u2014<>]|\p{Extended_Pictographic}/u;

const text = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .refine((value) => !FORBIDDEN_TEXT.test(value), {
      message: 'Remove dashes, emoji and markup from this text',
    });
const bool = z.boolean();
const int = (min: number, max: number) => z.number().int().min(min).max(max);
const minor = int(1, 9_000_000_000_000);

const email = z
  .string()
  .trim()
  .max(254)
  .refine((value) => value === '' || /^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']{2,}$/.test(value), {
    message: 'Enter a valid email address',
  });

const presets = (max: number) => z.array(int(1, max)).min(1).max(6);

const percentItem = z.strictObject({
  label: text(60).min(1),
  percent: int(1, 100),
  note: text(200),
});
const amountItem = z.strictObject({
  label: text(60).min(1),
  amount_minor: minor,
  note: text(200),
});

export const transparencyItems = z
  .array(z.union([percentItem, amountItem]))
  .max(12)
  .superRefine((items, ctx) => {
    const percents = items.filter((item) => 'percent' in item);
    if (percents.length > 0 && percents.length !== items.length) {
      ctx.addIssue({ code: 'custom', message: 'Use percentages for every line or amounts for every line' });
      return;
    }
    const total = percents.reduce((sum, item) => sum + ('percent' in item ? item.percent : 0), 0);
    if (percents.length > 0 && total !== 100) {
      ctx.addIssue({ code: 'custom', message: `Percentages must total 100 (now ${total})` });
    }
  });

interface MonetizationDef<S extends z.ZodType> {
  schema: S;
  default: z.infer<S>;
  isPublic: boolean;
  tier: 'admin' | 'super';
  group: 'monetization';
  label: string;
  description: string;
}

function def<S extends z.ZodType>(
  value: Omit<MonetizationDef<S>, 'group' | 'tier'> & { tier?: 'admin' | 'super' },
): MonetizationDef<S> {
  return { tier: 'admin', ...value, group: 'monetization' };
}

const sw = (label: string, description: string, isPublic = true) =>
  def({ schema: bool, default: false, isPublic, label, description });

export const MONETIZATION_DEFS = {
  'sponsors.enabled': sw(
    'Sponsors master switch',
    'Nothing sponsored is shown to anyone until this is on. Turning it on asks for your password.',
  ),
  'sponsors.placement.home_banner.enabled': sw(
    'Home banner',
    'One sponsor card between rows on Home',
  ),
  'sponsors.placement.title_card.enabled': sw(
    'Title page card',
    'One sponsor card on title pages, below the action buttons',
  ),
  'sponsors.placement.player_after.enabled': sw(
    'Message after a video',
    'A still sponsor card beside Up next when a video ends',
  ),
  'sponsors.placement.player_before.enabled': sw(
    'Message before a video',
    'A skippable still sponsor card before a video starts',
  ),
  'sponsors.home_banner.after_row': def({
    schema: int(1, 8),
    default: 3,
    isPublic: true,
    label: 'Home banner position',
    description: 'Show after this row. The banner never sits above the second row.',
  }),
  'sponsors.player_before.seconds': def({
    schema: int(3, 10),
    default: 5,
    isPublic: true,
    label: 'Before card seconds',
    description: 'How long the card waits before playback continues. Skip is always visible.',
  }),
  'sponsors.freq.home_banner_per_day': def({
    schema: int(1, 10),
    default: 2,
    isPublic: false,
    label: 'Home banner views per day',
    description: 'Per browser, per sponsor, per Lagos day',
  }),
  'sponsors.freq.title_card_per_day': def({
    schema: int(1, 20),
    default: 4,
    isPublic: false,
    label: 'Title card views per day',
    description: 'Per browser, per sponsor, per Lagos day',
  }),
  'sponsors.freq.player_after_per_session': def({
    schema: int(1, 5),
    default: 1,
    isPublic: false,
    label: 'After video cards per visit',
    description: 'Per browser session',
  }),
  'sponsors.freq.player_before_per_session': def({
    schema: int(1, 3),
    default: 1,
    isPublic: false,
    label: 'Before video cards per visit',
    description: 'Per browser session',
  }),
  'sponsors.label': def({
    schema: z.enum(['sponsored', 'sponsor_message', 'in_partnership_with']),
    default: 'sponsored' as 'sponsored' | 'sponsor_message' | 'in_partnership_with',
    isPublic: true,
    label: 'Sponsor label wording',
    description: 'The wording can change. The label can never be removed.',
  }),
  'sponsors.link_new_tab': def({
    schema: bool,
    default: true,
    isPublic: true,
    label: 'Open sponsor links in a new tab',
    description: 'Sponsor links open in a new tab',
  }),
  'sponsors.rotation': def({
    schema: z.enum(['even', 'weighted']),
    default: 'even' as 'even' | 'weighted',
    isPublic: false,
    label: 'Sponsor rotation',
    description: 'Even shares days equally. Weighted follows each creative weight.',
  }),
  'donate.enabled': sw(
    'Donations',
    'Shows the Donate page and links. Needs the Paystack key to be set on the server.',
  ),
  'donate.monthly.enabled': sw('Monthly giving', 'Donors can choose to give every month'),
  'donate.currencies': def({
    schema: z.array(z.enum(['NGN', 'USD'])).min(1).max(2),
    default: ['NGN'] as ('NGN' | 'USD')[],
    isPublic: true,
    label: 'Donation currencies',
    description: 'USD needs the USD switch and Paystack USD on your account',
  }),
  'donate.usd.enabled': sw('US dollar gifts', 'Lets donors abroad give in USD'),
  'donate.presets_minor.ngn': def({
    schema: presets(9_000_000_000),
    default: [50000, 100000, 200000, 500000],
    isPublic: true,
    label: 'Naira preset amounts',
    description: 'In kobo. 50000 is NGN 500.',
  }),
  'donate.presets_minor.usd': def({
    schema: presets(9_000_000_000),
    default: [500, 1000, 2500],
    isPublic: true,
    label: 'Dollar preset amounts',
    description: 'In cents. 500 is USD 5.',
  }),
  'donate.min_minor.ngn': def({
    schema: int(1000, 9_000_000_000),
    default: 20000,
    isPublic: true,
    label: 'Smallest naira gift',
    description: 'In kobo. Tiny gifts lose a large share to fees.',
  }),
  'donate.max_minor.ngn': def({
    schema: int(1000, 9_000_000_000_000),
    default: 500_000_000,
    isPublic: false,
    tier: 'super',
    label: 'Largest naira gift',
    description: 'In kobo. A guard against abuse.',
  }),
  'donate.org_name': def({
    schema: text(120),
    default: '',
    isPublic: true,
    label: 'Organisation legal name',
    description: 'Shown on the Donate page and on receipts',
  }),
  'donate.org_registration': def({
    schema: text(60),
    default: '',
    isPublic: true,
    label: 'Registration number',
    description: 'Optional. CAC or other registration number',
  }),
  'donate.intro_title': def({
    schema: text(80),
    default: 'Help keep lessons free',
    isPublic: true,
    label: 'Donate page title',
    description: 'Draft wording, change it',
  }),
  'donate.intro_body': def({
    schema: text(600),
    default: 'Gifts pay for hosting, captions and new lessons. Give what you wish.',
    isPublic: true,
    label: 'Donate page text',
    description: 'Draft wording, change it',
  }),
  'donate.thank_you_title': def({
    schema: text(80),
    default: 'Thank you',
    isPublic: true,
    label: 'Thank you title',
    description: 'Draft wording, change it',
  }),
  'donate.thank_you_body': def({
    schema: text(600),
    default: 'Your gift has been received. A receipt is on its way to your email.',
    isPublic: true,
    label: 'Thank you text',
    description: 'Draft wording, change it',
  }),
  'donate.cover_fees_option': sw(
    'Offer to cover fees',
    'Shows a checkbox so donors can add the fee to their gift',
  ),
  'donate.bank_transfer.enabled': sw(
    'Bank transfer details',
    'Shows your bank transfer instructions on the Donate page',
  ),
  'donate.bank_transfer.instructions': def({
    schema: z.string().trim().max(600),
    default: '',
    isPublic: true,
    label: 'Bank transfer instructions',
    description: 'Plain text. Shown escaped, never as markup.',
  }),
  'donate.transparency.enabled': sw(
    'Transparency page',
    'Shows a page explaining how gifts are used',
  ),
  'donate.transparency.title': def({
    schema: text(80),
    default: 'How gifts are used',
    isPublic: true,
    label: 'Transparency title',
    description: 'Draft wording, change it',
  }),
  'donate.transparency.intro': def({
    schema: text(600),
    default: '',
    isPublic: true,
    label: 'Transparency introduction',
    description: 'A short paragraph above the list',
  }),
  'donate.transparency.items': def({
    schema: transparencyItems,
    default: [] as z.infer<typeof transparencyItems>,
    isPublic: true,
    label: 'Transparency items',
    description: 'Use percentages that total 100, or amounts',
  }),
  'donate.transparency.updated_at': def({
    schema: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a date such as 2026-12-01')
      .nullable(),
    default: null as string | null,
    isPublic: true,
    label: 'Transparency last updated',
    description: 'Shown on the page',
  }),
  'donate.receipts.reply_to': def({
    schema: email,
    default: '',
    isPublic: false,
    label: 'Receipt reply address',
    description: 'Empty means the support email',
  }),
  'donate.retention.event_days': def({
    schema: int(7, 730),
    default: 90,
    isPublic: false,
    tier: 'super',
    label: 'Payment event retention (days)',
    description: 'Raw payment events are deleted after this many days',
  }),
} as const;

export type MonetizationKey = keyof typeof MONETIZATION_DEFS;
export const MONETIZATION_KEYS = Object.keys(MONETIZATION_DEFS) as MonetizationKey[];

export type MonetizationValues = { [K in MonetizationKey]: z.infer<(typeof MONETIZATION_DEFS)[K]['schema']> };

export interface MonetizationContext {
  /** True when PAYSTACK_SECRET_KEY is set on the server. */
  paystackKeyPresent: boolean;
}

/** Rules that span several keys. Returns messages per key, empty when everything is fine. */
export function crossCheckMonetization(
  values: MonetizationValues,
  context: MonetizationContext,
): Record<string, string[]> {
  const errors: Record<string, string[]> = {};
  const add = (key: MonetizationKey, message: string) => {
    (errors[key] ??= []).push(message);
  };
  const min = values['donate.min_minor.ngn'];
  const max = values['donate.max_minor.ngn'];
  if (min > max) add('donate.min_minor.ngn', 'The smallest gift cannot be above the largest gift');
  for (const preset of values['donate.presets_minor.ngn']) {
    if (preset < min) {
      add('donate.presets_minor.ngn', 'Every preset must be at or above the smallest gift (the minimum)');
      break;
    }
    if (preset > max) {
      add('donate.presets_minor.ngn', 'Every preset must be at or below the largest gift');
      break;
    }
  }
  if (values['donate.enabled'] && !context.paystackKeyPresent) {
    add('donate.enabled', 'Set PAYSTACK_SECRET_KEY on the server first, then turn donations on');
  }
  if (!values['donate.enabled']) {
    if (values['donate.monthly.enabled']) add('donate.monthly.enabled', 'Turn donations on first');
    if (values['donate.usd.enabled']) add('donate.usd.enabled', 'Turn donations on first');
  }
  if (values['donate.currencies'].includes('USD') && !values['donate.usd.enabled']) {
    add('donate.currencies', 'Turn on US dollar gifts before listing USD');
  }
  return errors;
}
