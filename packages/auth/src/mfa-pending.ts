import { hmacSha256 } from '@ad/shared';
import { timingSafeEqual } from 'node:crypto';

/** How long a correct password (or Google sign in) can wait for the second step. */
export const PENDING_MFA_SECONDS = 600;

const hex = (bytes: Uint8Array): string => Buffer.from(bytes).toString('hex');

/**
 * A signed, short lived note that the first step of a viewer sign in passed. It is not a session: nothing
 * about it opens account routes, so no account access exists until the code is accepted (M49-S02 AC1).
 */
export function signPendingMfa(pepper: Uint8Array, accountId: string, nowMs: number): string {
  const expires = Math.floor(nowMs / 1000) + PENDING_MFA_SECONDS;
  const body = `${accountId}.${expires}`;
  return `${body}.${hex(hmacSha256(pepper, `mfa-pending:${body}`))}`;
}

export function readPendingMfa(
  pepper: Uint8Array,
  token: string,
  nowMs: number,
): { accountId: string } | null {
  if (!token || token.length > 200) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [accountId, expires, mac] = parts as [string, string, string];
  const expected = Buffer.from(hex(hmacSha256(pepper, `mfa-pending:${accountId}.${expires}`)));
  const given = Buffer.from(mac);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  const expiresAt = Number(expires);
  if (!Number.isFinite(expiresAt) || expiresAt * 1000 <= nowMs) return null;
  return { accountId };
}
