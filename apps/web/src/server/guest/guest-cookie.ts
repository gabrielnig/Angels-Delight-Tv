import { constantTimeEqual, hmacSha256, randomToken } from '@ad/shared';

/**
 * The guest identity: a random 128 bit id in a signed cookie, minted only inside the playback session route (never
 * during a page render, and never on a browse only visit). It lets limits work without collecting personal data.
 * It is not an account and the two id spaces never mix (M40-S03, D-G2, D-G3).
 *
 * The MAC key is derived from the existing profile cookie secret with its own label, so there is no new secret to
 * configure. The shape matches `active-profile.ts`.
 */
const LABEL = 'ad:guest:v1';
const encoder = new TextEncoder();
const ID_SHAPE = /^[A-Za-z0-9_-]{22}$/;

export const GUEST_COOKIE_DAYS = 180;

export function guestCookieName(secure: boolean): string {
  return secure ? '__Host-ad_guest' : 'ad_guest';
}

export function guestCookieOptions(secure: boolean) {
  return {
    httpOnly: true,
    secure,
    sameSite: 'lax' as const,
    path: '/',
    maxAge: 60 * 60 * 24 * GUEST_COOKIE_DAYS,
  };
}

/** 128 bits of randomness as 22 url safe characters. */
export function newGuestId(): string {
  return randomToken(16);
}

function mac(secret: Uint8Array, id: string): string {
  const key = hmacSha256(secret, encoder.encode(LABEL));
  return Buffer.from(hmacSha256(key, encoder.encode(id))).toString('base64url');
}

export function signGuest(secret: Uint8Array, id: string): string {
  return `${id}.${mac(secret, id)}`;
}

/** The guest id, or null for a missing, malformed, truncated, forged or foreign value. */
export function readGuest(secret: Uint8Array, value: string | undefined | null): string | null {
  if (!value) return null;
  const parts = value.split('.');
  if (parts.length !== 2) return null;
  const [id, given] = parts as [string, string];
  if (!ID_SHAPE.test(id)) return null;
  const expected = encoder.encode(mac(secret, id));
  const got = encoder.encode(given);
  return got.length === expected.length && constantTimeEqual(got, expected) ? id : null;
}

/** The full `Set-Cookie` header value for a new guest id. */
export function guestSetCookie(secret: Uint8Array, secure: boolean, id: string): string {
  const o = guestCookieOptions(secure);
  return [
    `${guestCookieName(secure)}=${signGuest(secret, id)}`,
    `Max-Age=${o.maxAge}`,
    `Path=${o.path}`,
    'HttpOnly',
    ...(o.secure ? ['Secure'] : []),
    'SameSite=Lax',
  ].join('; ');
}
