import { constantTimeEqual, hmacSha256, isUuid } from '@ad/shared';

/**
 * The profile a browser is using right now, kept in a signed cookie. The signature covers the account id, so a
 * cookie copied to another account does not verify. It is only a hint for the kids gate: every service still
 * checks that the profile belongs to the signed in account (SECURITY.md, IDOR rules).
 */
const LABEL = 'ad:active-profile:v1';
const encoder = new TextEncoder();

export function activeProfileCookieName(secure: boolean): string {
  return secure ? '__Host-ad_profile' : 'ad_profile';
}

export function activeProfileCookieOptions(secure: boolean) {
  return { httpOnly: true, secure, sameSite: 'lax' as const, path: '/', maxAge: 60 * 60 * 24 * 30 };
}

function mac(secret: Uint8Array, accountId: string, profileId: string): string {
  const key = hmacSha256(secret, encoder.encode(LABEL));
  return Buffer.from(hmacSha256(key, encoder.encode(`${accountId}|${profileId}`))).toString(
    'base64url',
  );
}

export function signActiveProfile(
  secret: Uint8Array,
  accountId: string,
  profileId: string,
): string {
  return `${profileId}.${mac(secret, accountId, profileId)}`;
}

/** Returns the profile id, or null for a missing, malformed, forged or foreign cookie. */
export function readActiveProfile(
  secret: Uint8Array,
  accountId: string,
  value: string | undefined | null,
): string | null {
  if (!value) return null;
  const dot = value.indexOf('.');
  if (dot < 0) return null;
  const profileId = value.slice(0, dot);
  if (!isUuid(profileId)) return null;
  const given = encoder.encode(value.slice(dot + 1));
  const expected = encoder.encode(mac(secret, accountId, profileId));
  return given.length === expected.length && constantTimeEqual(given, expected) ? profileId : null;
}

export function cookieValue(header: string | null, name: string): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq > 0 && part.slice(0, eq).trim() === name) return part.slice(eq + 1).trim();
  }
  return undefined;
}
