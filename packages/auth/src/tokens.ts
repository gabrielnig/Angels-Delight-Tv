import { constantTimeEqual, hmacSha256, randomToken, sha256 } from '@ad/shared';
import { randomInt } from 'node:crypto';

/** 256 bit url safe token. Only its SHA-256 is stored. */
export const generateToken = (): string => randomToken(32);

export const hashToken = (token: string): Uint8Array => sha256(token);

export const tokensMatch = (a: Uint8Array, b: Uint8Array): boolean => constantTimeEqual(a, b);

/** Uniform six digit code. `source` is only for tests. */
export function generateCode(source: (max: number) => number = (max) => randomInt(max)): string {
  return String(source(1_000_000)).padStart(6, '0');
}

/**
 * Six digits are brute forceable offline, so the stored value is keyed with the server pepper and bound to the
 * account. Online guessing is capped by the attempts counter.
 */
export const hashCode = (pepper: Uint8Array, accountId: string, code: string): Uint8Array =>
  hmacSha256(pepper, `code:${accountId}:${code}`);
