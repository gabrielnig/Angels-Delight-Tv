import { lagosDayEnd, lagosDayStart } from '../status';

export type Checked<T> = { ok: true; value: T } | { ok: false; error: string };
export type CheckedFields<T> = { ok: true; value: T } | { ok: false; errors: Record<string, string> };

const FORBIDDEN = /[\u2013\u2014\u2018\u2019\u201C\u201D]|\p{Extended_Pictographic}/u;
// eslint-disable-next-line no-control-regex
const CONTROL = /[\u0000-\u001F\u007F]/g;

/** Trims, drops control characters and collapses inner whitespace. */
export const cleanText = (value: unknown): string =>
  typeof value === 'string' ? value.replace(CONTROL, ' ').replace(/\s+/g, ' ').trim() : '';

/** Rules shared by every line of sponsor copy: no markup, no dashes, no emoji. */
function textProblem(value: string): string | null {
  if (/[<>]/.test(value)) return 'Remove the angle brackets. Sponsor text cannot contain markup.';
  if (FORBIDDEN.test(value)) return 'Remove dashes, curly quotes and emoji. Use plain words.';
  return null;
}

export function validateSponsorName(raw: unknown): Checked<string> {
  const value = cleanText(raw);
  if (value.length < 1) return { ok: false, error: 'Add the sponsor name.' };
  if (value.length > 80) return { ok: false, error: 'Keep the name to 80 characters.' };
  const problem = textProblem(value);
  return problem ? { ok: false, error: problem } : { ok: true, value };
}

export interface DestinationOptions {
  /** Our own hostnames. A sponsor link may never point back at the platform. */
  ownHosts: readonly string[];
}

export function validateDestination(raw: unknown, options: DestinationOptions): Checked<string> {
  const text = typeof raw === 'string' ? raw.trim() : '';
  if (!text) return { ok: false, error: 'Add the sponsor website link.' };
  if (text.length > 500) return { ok: false, error: 'Keep the link under 500 characters.' };
  if (/[\s\u0000-\u001F\u007F]/.test(text)) return { ok: false, error: 'The link cannot contain spaces.' };
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    return { ok: false, error: 'Enter a full link that starts with https://' };
  }
  if (url.protocol !== 'https:') return { ok: false, error: 'The link must start with https://' };
  if (url.username || url.password) return { ok: false, error: 'The link cannot contain a user name or password.' };
  const host = url.hostname.toLowerCase().replace(/\.$/, '');
  const unsafe =
    'That address is not a public website. Use the sponsor domain name, for example https://sponsor.example';
  if (!host) return { ok: false, error: unsafe };
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal') || host.endsWith('.lan') || host.endsWith('.home.arpa'))
    return { ok: false, error: unsafe };
  if (host.startsWith('[') || host.includes(':')) return { ok: false, error: unsafe };
  if (/^\d+(\.\d+){3}$/.test(host) || /^\d+$/.test(host) || /^0x[0-9a-f]+$/i.test(host)) {
    // Any address typed as numbers is refused, private or not: a sponsor has a domain name.
    return { ok: false, error: unsafe };
  }
  if (!host.includes('.')) return { ok: false, error: unsafe };
  if (options.ownHosts.some((own) => own.toLowerCase() === host)) {
    return { ok: false, error: 'The link points back at this site. Use the sponsor own website.' };
  }
  return { ok: true, value: text };
}

export interface CreativeInput {
  headline: unknown;
  body?: unknown;
  ctaLabel?: unknown;
  destinationUrl: unknown;
  altText?: unknown;
  decorative?: unknown;
  weight?: unknown;
  hasImage: boolean;
}

export interface CreativeValue {
  headline: string;
  body: string | null;
  ctaLabel: string;
  destinationUrl: string;
  altText: string | null;
  weight: number;
}

export function validateCreative(input: CreativeInput, options: DestinationOptions): CheckedFields<CreativeValue> {
  const errors: Record<string, string> = {};
  const headline = cleanText(input.headline);
  if (!headline) errors.headline = 'Add a headline.';
  else if (headline.length > 60) errors.headline = 'Keep the headline to 60 characters.';
  else {
    const p = textProblem(headline);
    if (p) errors.headline = p;
  }

  const bodyText = cleanText(input.body);
  let body: string | null = null;
  if (bodyText) {
    if (bodyText.length > 140) errors.body = 'Keep the text to 140 characters.';
    else {
      const p = textProblem(bodyText);
      if (p) errors.body = p;
      else body = bodyText;
    }
  }

  const ctaText = cleanText(input.ctaLabel);
  let ctaLabel = 'Learn more';
  if (ctaText) {
    if (ctaText.length > 24) errors.ctaLabel = 'Keep the button words to 24 characters.';
    else {
      const p = textProblem(ctaText);
      if (p) errors.ctaLabel = p;
      else ctaLabel = ctaText;
    }
  }

  const dest = validateDestination(input.destinationUrl, options);
  if (!dest.ok) errors.destinationUrl = dest.error;

  let altText: string | null = null;
  const alt = cleanText(input.altText);
  if (alt.length > 120) errors.altText = 'Keep the picture description to 120 characters.';
  else if (alt) {
    const p = textProblem(alt);
    if (p) errors.altText = p;
    else altText = alt;
  } else if (input.hasImage && input.decorative !== true) {
    errors.altText = 'Describe the picture, or tick that it is decorative.';
  }

  const weight = input.weight === undefined || input.weight === '' ? 1 : Number(input.weight);
  if (!Number.isInteger(weight) || weight < 1 || weight > 10) errors.weight = 'Use a whole number from 1 to 10.';

  if (Object.keys(errors).length > 0 || !dest.ok) return { ok: false, errors };
  return { ok: true, value: { headline, body, ctaLabel, destinationUrl: dest.value, altText, weight } };
}

export interface ScheduleInput {
  startDay: unknown;
  endDay: unknown;
}

export function validateSchedule(
  input: ScheduleInput,
): CheckedFields<{ startsAt: Date | null; endsAt: Date | null }> {
  const errors: Record<string, string> = {};
  let startsAt: Date | null = null;
  let endsAt: Date | null = null;
  const start = cleanText(input.startDay);
  const end = cleanText(input.endDay);
  if (start) {
    try {
      startsAt = lagosDayStart(start);
    } catch {
      errors.startDay = 'Enter the start date as a real day, for example 2026-12-01.';
    }
  }
  if (end) {
    try {
      endsAt = lagosDayEnd(end);
    } catch {
      errors.endDay = 'Enter the end date as a real day, for example 2026-12-31.';
    }
  }
  if (startsAt && endsAt && endsAt.getTime() <= startsAt.getTime()) {
    errors.endDay = 'The end date must be on or after the start date.';
  }
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, value: { startsAt, endsAt } };
}
