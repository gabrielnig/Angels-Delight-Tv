import { createHmac, timingSafeEqual } from 'node:crypto';

const HEX_SHA512 = /^[0-9a-f]{128}$/;

/**
 * Checks the `x-paystack-signature` header: HMAC SHA512 of the raw request body keyed with the secret key, as
 * lowercase hex. The body must be the exact bytes received, not parsed and written out again. Never throws.
 */
export function verifyPaystackSignature(
  rawBody: string | Uint8Array,
  header: string | null | undefined,
  secret: string,
): boolean {
  if (!secret || typeof header !== 'string' || !HEX_SHA512.test(header)) return false;
  const expected = createHmac('sha512', secret).update(rawBody).digest();
  const given = Buffer.from(header, 'hex');
  return given.length === expected.length && timingSafeEqual(given, expected);
}
