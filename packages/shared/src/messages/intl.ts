import { localeInfo } from './locales';

export type PluralCategory = Intl.LDMLPluralRule;
const BASE = 'en-NG';

function intlLocale(locale: string): string {
  const info = localeInfo(locale);
  const candidates = info ? info.intl : [locale, BASE];
  for (const c of candidates) {
    try {
      if (Intl.NumberFormat.supportedLocalesOf([c]).length > 0) return c;
    } catch {
      // invalid tag, try the next
    }
  }
  return BASE;
}

export function pluralCategory(locale: string, count: number): PluralCategory {
  const info = localeInfo(locale);
  const candidates = info ? info.intl : [locale, BASE];
  for (const c of candidates) {
    try {
      if (Intl.PluralRules.supportedLocalesOf([c]).length > 0) {
        return new Intl.PluralRules(c).select(count);
      }
    } catch {
      // invalid tag, try the next
    }
  }
  return new Intl.PluralRules(BASE).select(count);
}

export function formatNumber(value: number, locale: string = BASE): string {
  return new Intl.NumberFormat(intlLocale(locale)).format(value);
}

/** "17 Nov 2026". Lagos time, falling back to en-NG month names. */
export function formatDate(date: Date, locale: string = BASE, timeZone = 'Africa/Lagos'): string {
  return new Intl.DateTimeFormat(intlLocale(locale), {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone,
  }).format(date);
}
