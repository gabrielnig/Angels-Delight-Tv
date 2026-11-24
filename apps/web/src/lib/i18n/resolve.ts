import {
  DEFAULT_LOCALE,
  normalizeLocale,
  parseAcceptLanguage,
  type LocaleCode,
} from '@ad/shared/messages';

export interface ResolveInput {
  /** ?lang= from the URL. */
  query?: string | null;
  /** The selected profile's language, a kids profile included. */
  profileLanguage?: string | null;
  /** accounts.locale. */
  accountLocale?: string | null;
  /** The ad_locale cookie. */
  cookie?: string | null;
  acceptLanguage?: string | null;
  /** content.ui_languages. */
  enabled: readonly string[];
  /** content.default_language. */
  fallback?: LocaleCode;
}

/** First match among enabled locales: query, profile, account, cookie, Accept-Language, site default (M46 4.2). */
export function resolveLocale(input: ResolveInput): LocaleCode {
  const enabled = new Set(input.enabled);
  const usable = (value: string | null | undefined): LocaleCode | null => {
    const code = normalizeLocale(value);
    return code && enabled.has(code) ? code : null;
  };
  for (const step of [input.query, input.profileLanguage, input.accountLocale, input.cookie]) {
    const hit = usable(step);
    if (hit) return hit;
  }
  for (const code of parseAcceptLanguage(input.acceptLanguage)) {
    if (enabled.has(code)) return code;
  }
  const fallback = input.fallback ?? DEFAULT_LOCALE;
  return enabled.has(fallback) ? fallback : DEFAULT_LOCALE;
}
