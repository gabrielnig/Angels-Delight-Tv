import { describe, expect, it } from 'vitest';
import { LOCALE_COOKIE, localeCookieOptions, readLocaleCookie } from './cookie';

describe('locale cookie', () => {
  it('sets ad_locale with Lax, Secure, 365 days and readable by the picker', () => {
    expect(LOCALE_COOKIE).toBe('ad_locale');
    const o = localeCookieOptions(true);
    expect(o).toMatchObject({ sameSite: 'lax', secure: true, path: '/', maxAge: 365 * 24 * 60 * 60 });
    expect(o.httpOnly).toBeFalsy();
    expect(localeCookieOptions(false).secure).toBe(false);
  });
  it('ignores a forged or unknown cookie value', () => {
    expect(readLocaleCookie('yo')).toBe('yo');
    expect(readLocaleCookie('yo-NG')).toBe('yo');
    expect(readLocaleCookie('xx')).toBeNull();
    expect(readLocaleCookie('<script>')).toBeNull();
    expect(readLocaleCookie(undefined)).toBeNull();
  });
});
