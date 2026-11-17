import { constantTimeEqual, hmacSha256 } from '@ad/shared';

/**
 * The short lived cookie that remembers which address is being verified, so /verify-email works before any
 * session exists. It is signed, not secret: it holds the normalised address and an expiry.
 */
export interface PendingVerification {
  email: string;
  expiresAt: number;
}

export function signPending(pepper: Uint8Array, pending: PendingVerification): string {
  const payload = Buffer.from(JSON.stringify(pending)).toString('base64url');
  const mac = Buffer.from(hmacSha256(pepper, `pending:${payload}`)).toString('base64url');
  return `${payload}.${mac}`;
}

export function readPending(
  pepper: Uint8Array,
  value: string | undefined,
  now: number = Date.now(),
): PendingVerification | null {
  if (!value || value.length > 600) return null;
  const [payload, mac, extra] = value.split('.');
  if (!payload || !mac || extra !== undefined) return null;
  const expected = hmacSha256(pepper, `pending:${payload}`);
  const given = new Uint8Array(Buffer.from(mac, 'base64url'));
  if (!constantTimeEqual(expected, given)) return null;
  try {
    const parsed = JSON.parse(
      Buffer.from(payload, 'base64url').toString('utf8'),
    ) as PendingVerification;
    if (typeof parsed.email !== 'string' || typeof parsed.expiresAt !== 'number') return null;
    return parsed.expiresAt > now ? parsed : null;
  } catch {
    return null;
  }
}
