import { constantTimeEqual, hmacSha256 } from '@ad/shared';

/** The purpose is part of the signed text, so this token cannot be used for any other signed link. */
const sign = (secret: Uint8Array, reference: string) => hmacSha256(secret, `donate-receipt:v1:${reference}`);

/** Goes in the Paystack callback url. Shows the donor their own gift on the thank you page and nothing else. */
export const issueReceiptToken = (secret: Uint8Array, reference: string): string =>
  Buffer.from(sign(secret, reference)).toString('base64url');

/** Constant time. Never throws, whatever the input is. */
export function verifyReceiptToken(secret: Uint8Array, reference: string, token: unknown): boolean {
  if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(token)) return false;
  const bytes = Buffer.from(token, 'base64url');
  // Only the canonical spelling counts: the last character carries spare bits that decode to the same bytes.
  if (bytes.toString('base64url') !== token) return false;
  return constantTimeEqual(new Uint8Array(bytes), sign(secret, reference));
}
