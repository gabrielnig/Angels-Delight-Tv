import { describe, expect, it } from 'vitest';
import {
  GUEST_AUDIENCE_DAYS,
  guestAudienceCookieName,
  guestAudienceCookieOptions,
  readGuestAudienceCookie,
  resolveGuestAudience,
} from './guest-audience';

describe('guest audience (M40-S09, R18)', () => {
  it('names the cookie with the host prefix only when secure', () => {
    expect(guestAudienceCookieName(true)).toBe('__Host-ad_gaud');
    expect(guestAudienceCookieName(false)).toBe('ad_gaud');
  });

  it('is http only, lax, root path and lasts 180 days', () => {
    expect(guestAudienceCookieOptions(true)).toEqual({
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * GUEST_AUDIENCE_DAYS,
    });
    expect(GUEST_AUDIENCE_DAYS).toBe(180);
  });

  it('is tri state: k is kids, g is general, absent follows the site default', () => {
    expect(resolveGuestAudience('k', 'general')).toBe('kids');
    expect(resolveGuestAudience('g', 'kids')).toBe('general');
    expect(resolveGuestAudience(undefined, 'general')).toBe('general');
    expect(resolveGuestAudience(undefined, 'kids')).toBe('kids');
  });

  it.each(['', 'K', 'kids', 'general', '1', 'k;g', ' k', 'x'.repeat(500)])(
    'falls back to the site default for the junk value %j',
    (junk) => {
      expect(resolveGuestAudience(junk, 'general')).toBe('general');
      expect(resolveGuestAudience(junk, 'kids')).toBe('kids');
    },
  );

  it('reads the cookie from a request header by name', () => {
    const req = (cookie: string) => new Request('https://a.test/', { headers: { cookie } });
    expect(readGuestAudienceCookie(req('a=1; __Host-ad_gaud=k; b=2'), true)).toBe('k');
    expect(readGuestAudienceCookie(req('ad_gaud=g'), false)).toBe('g');
    expect(readGuestAudienceCookie(req('ad_gaud=k'), true)).toBeUndefined();
    expect(readGuestAudienceCookie(new Request('https://a.test/'), true)).toBeUndefined();
  });
});
