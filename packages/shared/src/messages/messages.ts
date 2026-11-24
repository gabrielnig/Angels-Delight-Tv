/**
 * Message catalogs (M34-S04). `msg` reads the en-NG catalog. A missing key never throws: it falls back to
 * English and reports the key once, and if English lacks it too the key itself is shown.
 */
import { EN_NG } from './en-ng';
import { formatNumber, pluralCategory } from './intl';

export { formatNumber } from './intl';

/** A plain string, or plural forms by CLDR category with `other` required. */
export type MessageText = string | ({ other: string } & Partial<Record<Intl.LDMLPluralRule, string>>);
export type CatalogShape = Record<string, MessageText>;
export type MessageKey = keyof typeof EN_NG;
export type MessageParams = Record<string, string | number>;

const BASE = 'en-NG';

export type Translate = (key: MessageKey, params?: MessageParams) => string;

export function createMessages(
  locale: string,
  catalogs: Record<string, CatalogShape>,
  onMissing: (key: string, locale: string) => void = (key, loc) =>
    console.warn(`Missing message "${key}" for ${loc}`),
): Translate {
  const reported = new Set<string>();
  if (locale === 'en') locale = BASE;
  return (key, params) => {
    let text: MessageText | undefined = catalogs[locale]?.[key];
    if (text === undefined) {
      if (!reported.has(key)) {
        reported.add(key);
        onMissing(key, locale);
      }
      text = catalogs[BASE]?.[key];
    }
    if (text === undefined) return key;
    const chosen =
      typeof text === 'string'
        ? text
        : (text[pluralCategory(locale, Number(params?.['count']))] ?? text.other);
    return chosen.replace(/\{(\w+)\}/g, (whole, name: string) => {
      const value = params?.[name];
      if (value === undefined) return whole;
      return name === 'count' && typeof value === 'number'
        ? formatNumber(value, locale)
        : String(value);
    });
  };
}

/** The shared translator for the default locale. */
export const msg: Translate = createMessages(BASE, { [BASE]: EN_NG });
