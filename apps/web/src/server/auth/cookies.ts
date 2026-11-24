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

export interface CookieOptions {
  httpOnly: true;
  secure: boolean;
  sameSite: 'lax';
  path: '/';
  maxAge?: number;
}

/** Staff cookies are browser-session cookies, so they carry no Max-Age. No Domain, so __Host- rules hold. */
export function sessionCookieOptions(input: {
  secure: boolean;
  kind: SessionCookieKind;
  idleSeconds: number;
}): CookieOptions {
  const base: CookieOptions = { httpOnly: true, secure: input.secure, sameSite: 'lax', path: '/' };
  return input.kind === 'staff' ? base : { ...base, maxAge: input.idleSeconds };
}

export function pendingCookieOptions(secure: boolean, maxAge: number): CookieOptions {
  return { httpOnly: true, secure, sameSite: 'lax', path: '/', maxAge };
}
