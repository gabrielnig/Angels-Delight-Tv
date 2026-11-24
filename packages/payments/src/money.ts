export type Currency = 'NGN' | 'USD';

const MAJOR = /^\d+(\.\d{1,2})?$/;

/** A whole, positive amount in the currency subunit (kobo or cents) that fits exactly in a number. */
export function isMinorAmount(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}

/**
 * Reads a major amount ("1000.50") into the subunit without floating point. Returns null for anything that is not
 * a plain positive decimal with at most two places. A number is read through its decimal text, so a value that
 * only exists because of float error (0.1 + 0.2) is refused.
 */
export function toMinor(major: string | number, _currency: Currency): number | null {
  const text = (typeof major === 'number' ? String(major) : major).trim();
  if (!MAJOR.test(text)) return null;
  const [whole = '0', fraction = ''] = text.split('.');
  const minor = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'));
  if (minor <= 0n || minor > BigInt(Number.MAX_SAFE_INTEGER)) return null;
  return Number(minor);
}

const FORMATS: Record<Currency, { locale: string; currency: string }> = {
  NGN: { locale: 'en-NG', currency: 'NGN' },
  USD: { locale: 'en-US', currency: 'USD' },
};

export function formatMoney(minor: number, currency: Currency): string {
  const spec = FORMATS[currency];
  const whole = minor % 100 === 0;
  const text = new Intl.NumberFormat(spec.locale, {
    style: 'currency',
    currency: spec.currency,
    currencyDisplay: currency === 'USD' ? 'code' : 'narrowSymbol',
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: whole ? 0 : 2,
  }).format(minor / 100);
  return currency === 'USD' ? text.replace(/^USD\s?/, 'US$') : text;
}

export type AmountCheck =
  | { ok: true }
  | { ok: false; reason: 'invalid' | 'below_min' | 'above_max' };

export function checkAmount(minor: unknown, limits: { min: number; max: number }): AmountCheck {
  if (!isMinorAmount(minor)) return { ok: false, reason: 'invalid' };
  if (minor < limits.min) return { ok: false, reason: 'below_min' };
  if (minor > limits.max) return { ok: false, reason: 'above_max' };
  return { ok: true };
}
