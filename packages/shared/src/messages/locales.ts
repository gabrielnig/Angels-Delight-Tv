/**
 * Locale registry (M46). Stored values are the short codes. `en` is the source of truth and the fallback.
 * No locale URL prefix is used (see D-246): the locale comes from the query, profile, account, cookie or header.
 */
export const LOCALE_CODES = ['en', 'yo', 'ig', 'ha', 'pcm'] as const;
export type LocaleCode = (typeof LOCALE_CODES)[number];

export interface LocaleInfo {
  code: LocaleCode;
  /** Value for the html lang attribute. */
  htmlLang: string;
  endonym: string;
  englishName: string;
  /** Intl locales to try in order, the last is always en-NG. */
  intl: readonly string[];
  /** The source language cannot be translated into. */
  source: boolean;
}

export const LOCALES: readonly LocaleInfo[] = [
  { code: 'en', htmlLang: 'en-NG', endonym: 'English', englishName: 'English', intl: ['en-NG'], source: true },
  { code: 'yo', htmlLang: 'yo', endonym: 'Yorùbá', englishName: 'Yoruba', intl: ['yo-NG', 'en-NG'], source: false },
  { code: 'ig', htmlLang: 'ig', endonym: 'Igbo', englishName: 'Igbo', intl: ['ig-NG', 'en-NG'], source: false },
  { code: 'ha', htmlLang: 'ha', endonym: 'Hausa', englishName: 'Hausa', intl: ['ha-NG', 'en-NG'], source: false },
  { code: 'pcm', htmlLang: 'pcm', endonym: 'Naijá', englishName: 'Nigerian Pidgin', intl: ['pcm', 'en-NG'], source: false },
];

export const DEFAULT_LOCALE: LocaleCode = 'en';
const MAX_TAG = 35;

export function localeInfo(code: string): LocaleInfo | undefined {
  return LOCALES.find((l) => l.code === code);
}

/** Maps yo-NG, ha-Latn-NG, EN-gb and so on to a code. Anything else is null. */
export function normalizeLocale(input: string | null | undefined): LocaleCode | null {
  if (typeof input !== 'string') return null;
  const tag = input.trim();
  if (tag.length === 0 || tag.length > MAX_TAG) return null;
  const primary = tag.toLowerCase().split(/[-_]/)[0] ?? '';
  return (LOCALE_CODES as readonly string[]).includes(primary) ? (primary as LocaleCode) : null;
}

/** Accept-Language to supported codes, best first. Zero q and malformed entries are dropped. */
export function parseAcceptLanguage(header: string | null | undefined): LocaleCode[] {
  if (!header) return [];
  const ranked: { code: LocaleCode; q: number; order: number }[] = [];
  header.split(',').forEach((part, order) => {
    const [tag = '', ...params] = part.trim().split(';');
    let q = 1;
    for (const p of params) {
      const m = /^\s*q=(.*)$/i.exec(p);
      if (m) q = /^\d(\.\d{0,3})?$/.test(m[1] ?? '') ? Number(m[1]) : 1;
    }
    const code = normalizeLocale(tag);
    if (!code || q <= 0 || q > 1) return;
    if (!ranked.some((r) => r.code === code)) ranked.push({ code, q, order });
  });
  return ranked.sort((a, b) => b.q - a.q || a.order - b.order).map((r) => r.code);
}

/** The first wanted locale that is enabled, else the default. */
export function pickLocale(
  wanted: readonly string[],
  enabled: readonly string[],
  fallback: LocaleCode = DEFAULT_LOCALE,
): LocaleCode {
  for (const w of wanted) {
    const code = normalizeLocale(w);
    if (code && enabled.includes(code)) return code;
  }
  return fallback;
}
