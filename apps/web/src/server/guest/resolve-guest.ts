import { cookieValue } from '../viewer/active-profile';
import { guestCookieName, newGuestId, readGuest } from './guest-cookie';

export interface ResolveGuestOptions {
  secret: Uint8Array;
  secure: boolean;
  /** Create an id when the cookie is absent or invalid. Only the playback session route passes true. */
  mint: boolean;
}

/** A verified guest id from the cookie, a fresh one when asked to mint, or null. A forged cookie counts as absent. */
export function resolveGuest(
  request: Request,
  options: ResolveGuestOptions,
): { guestId: string; isNew: boolean } | null {
  const existing = readGuest(
    options.secret,
    cookieValue(request.headers.get('cookie'), guestCookieName(options.secure)),
  );
  if (existing) return { guestId: existing, isNew: false };
  return options.mint ? { guestId: newGuestId(), isNew: true } : null;
}
