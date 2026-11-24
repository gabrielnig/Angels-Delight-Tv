import { hmacSha256 } from '@ad/shared';
import { timingSafeEqual } from 'node:crypto';

const MAX_LENGTH = 2048;

const mac = (pepper: Uint8Array, purpose: string, body: string): string =>
  Buffer.from(hmacSha256(pepper, `oauth-note:${purpose}:${body}`)).toString('base64url');

/**
 * A signed, short lived note the browser carries between the steps of Google sign in (the state cookie, the
 * link confirmation and the sign up consent step). It is signed, not encrypted, so it only holds values the
 * person already has. The purpose is part of the signature, so one kind of note never passes as another.
 */
export function signNote(
  pepper: Uint8Array,
  purpose: string,
  payload: Record<string, unknown>,
  ttlSeconds: number,
  nowMs: number,
): string {
  const body = Buffer.from(
    JSON.stringify({ ...payload, exp: Math.floor(nowMs / 1000) + ttlSeconds }),
  ).toString('base64url');
  return `${body}.${mac(pepper, purpose, body)}`;
}

export function readNote<T extends Record<string, unknown>>(
  pepper: Uint8Array,
  purpose: string,
  token: string | null | undefined,
  nowMs: number,
): T | null {
  if (!token || token.length > MAX_LENGTH) return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [body, given] = parts as [string, string];
  const expected = Buffer.from(mac(pepper, purpose, body));
  const actual = Buffer.from(given);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as T & {
      exp?: unknown;
    };
    if (typeof payload.exp !== 'number' || payload.exp * 1000 <= nowMs) return null;
    return payload;
  } catch {
    return null;
  }
}
