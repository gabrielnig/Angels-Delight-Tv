export type SessionCookieKind = 'viewer' | 'staff' | 'pending_mfa';

export function sessionCookieName(secure: boolean): string {
  return secure ? '__Host-ad_session' : 'ad_session';
}

export function pendingCookieName(secure: boolean): string {
  return secure ? '__Host-ad_pv' : 'ad_pv';
}

/** The signed note that a viewer password was right and a code is still needed. Not a session (M49-S02). */
export function twoStepCookieName(secure: boolean): string {
  return secure ? '__Host-ad_mv' : 'ad_mv';
}

/** The signed state, nonce and PKCE verifier for one trip to Google. Lives ten minutes (M49-S05). */
export function googleStateCookieName(secure: boolean): string {
  return secure ? '__Host-ad_oauth' : 'ad_oauth';
}

/** The signed note between the Google callback and the link confirmation or consent screen. */
export function googleNoteCookieName(secure: boolean): string {
  return secure ? '__Host-ad_goog' : 'ad_goog';
}

/** A random id for this browser, used to tell a new device from a known one (M49-S13). Long lived, never shown. */
export function deviceCookieName(secure: boolean): string {
  return secure ? '__Host-ad_dev' : 'ad_dev';
}

/** The remembered staff device (D-397). Holds a random token whose hash is in `trusted_devices`. */
export function trustedDeviceCookieName(secure: boolean): string {
  return secure ? '__Host-ad_td' : 'ad_td';
}

export const DEVICE_COOKIE_DAYS = 400;

export interface CookieOptions {
  httpOnly: true;
  secure: boolean;
  sameSite: 'lax';
  path: '/';
  maxAge?: number;
}

/**
 * Viewer and waiting cookies last as long as the idle window. A staff cookie lasts the absolute window and the server
 * enforces the sliding idle window, so staff stay signed in across browser restarts (D-397). No Domain, so __Host- rules hold.
 */
export function sessionCookieOptions(input: {
  secure: boolean;
  kind: SessionCookieKind;
  idleSeconds: number;
  absoluteSeconds?: number;
}): CookieOptions {
  const base: CookieOptions = { httpOnly: true, secure: input.secure, sameSite: 'lax', path: '/' };
  const maxAge = input.kind === 'staff' ? (input.absoluteSeconds ?? input.idleSeconds) : input.idleSeconds;
  return { ...base, maxAge };
}

export function pendingCookieOptions(secure: boolean, maxAge: number): CookieOptions {
  return { httpOnly: true, secure, sameSite: 'lax', path: '/', maxAge };
}
