import { cookieValue } from '../viewer/active-profile';

/**
 * Who a guest is shown videos for (M40-S09, D-G8). A device choice in the cookie `__Host-ad_gaud` (`k` for Kids
 * mode, `g` for general) wins. With no choice the site setting `features.guest_audience` decides. The cookie is
 * unsigned on purpose: it is a convenience and not a lock, and anyone using the device can change it.
 */
export type GuestAudienceName = 'general' | 'kids';

export const GUEST_AUDIENCE_DAYS = 180;

export const guestAudienceCookieName = (secure: boolean): string =>
  secure ? '__Host-ad_gaud' : 'ad_gaud';

export function guestAudienceCookieOptions(secure: boolean) {
  return {
    httpOnly: true,
    secure,
    sameSite: 'lax' as const,
    path: '/',
    maxAge: 60 * 60 * 24 * GUEST_AUDIENCE_DAYS,
  };
}

/** Anything that is not exactly `k` or `g` counts as no choice, so a junk value cannot change what is shown. */
export function resolveGuestAudience(
  cookie: string | undefined | null,
  siteDefault: GuestAudienceName,
): GuestAudienceName {
  if (cookie === 'k') return 'kids';
  if (cookie === 'g') return 'general';
  return siteDefault;
}

export function readGuestAudienceCookie(request: Request, secure: boolean): string | undefined {
  return cookieValue(request.headers.get('cookie'), guestAudienceCookieName(secure));
}

/** The audience a request is shown, from the device cookie and then the site default. */
export function guestAudienceFromRequest(
  request: Request,
  secure: boolean,
  siteDefault: GuestAudienceName,
): GuestAudienceName {
  return resolveGuestAudience(readGuestAudienceCookie(request, secure), siteDefault);
}
