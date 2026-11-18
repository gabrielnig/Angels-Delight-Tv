/**
 * Message catalogs (M34-S04). `msg` reads the en-NG catalog. A missing key never throws: it falls back to
 * English and reports the key once, and if English lacks it too the key itself is shown.
 */
import { EN_NG } from './en-ng';

export type MessageText = string | { one: string; other: string };
export type CatalogShape = Record<string, MessageText>;
export type MessageKey = keyof typeof EN_NG;
export type MessageParams = Record<string, string | number>;

const BASE = 'en-NG';

export function formatNumber(value: number, locale: string = BASE): string {
  return new Intl.NumberFormat(locale).format(value);
}

/** 6 becomes "6 min", 60 becomes "1 hr", 220 becomes "3 hr 40 min". */
export function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest} min`;
  return rest === 0 ? `${hours} hr` : `${hours} hr ${rest} min`;
}

export type Translate = (key: MessageKey, params?: MessageParams) => string;

export function createMessages(
  locale: string,
  catalogs: Record<string, CatalogShape>,
  onMissing: (key: string, locale: string) => void = (key, loc) =>
    console.warn(`Missing message "${key}" for ${loc}`),
): Translate {
  const reported = new Set<string>();
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
      typeof text === 'string' ? text : Number(params?.['count']) === 1 ? text.one : text.other;
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
