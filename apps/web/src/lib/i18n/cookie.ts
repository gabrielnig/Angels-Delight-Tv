import { normalizeLocale, type LocaleCode } from '@ad/shared/messages';

/** Functional cookie holding the viewer's language. No tracking. Not HttpOnly so the picker can read it. */
export const LOCALE_COOKIE = 'ad_locale';
export const LOCALE_COOKIE_MAX_AGE = 365 * 24 * 60 * 60;

export function localeCookieOptions(secure: boolean) {
  return {
    path: '/',
    sameSite: 'lax' as const,
    secure,
    httpOnly: false,
    maxAge: LOCALE_COOKIE_MAX_AGE,
  };
}

export function readLocaleCookie(raw: string | undefined | null): LocaleCode | null {
  return normalizeLocale(raw);
}
