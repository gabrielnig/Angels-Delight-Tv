import { guestAudienceCookieName, guestAudienceCookieOptions } from './guest-audience';

interface Jar {
  set(name: string, value: string, options: ReturnType<typeof guestAudienceCookieOptions>): unknown;
}

/** Remembers the Kids mode choice of this device: `k` for on, `g` for off. Only a boolean is accepted (M40-S09). */
export function setGuestAudience(jar: Jar, kids: boolean, secure: boolean): void {
  if (typeof kids !== 'boolean') throw new TypeError('kids must be a boolean');
  jar.set(guestAudienceCookieName(secure), kids ? 'k' : 'g', guestAudienceCookieOptions(secure));
}
