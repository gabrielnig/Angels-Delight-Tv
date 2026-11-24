import { randomBytes } from 'node:crypto';

/** Paystack allows only letters, digits, hyphen, dot and equals in a reference, so no underscores. */
export const REFERENCE_PREFIX = 'ad-don-';
const BODY_LENGTH = 20;
const ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';
const SHAPE = new RegExp(`^${REFERENCE_PREFIX}[a-z0-9]{${BODY_LENGTH}}$`);

/** A new reference made only from random bytes. It never contains a name, email or amount. */
export function newReference(bytes: (n: number) => Uint8Array = (n) => randomBytes(n)): string {
  let body = '';
  // 252 is the largest multiple of 36 under 256, so every character is equally likely.
  for (let round = 0; round < 8 && body.length < BODY_LENGTH; round += 1) {
    for (const byte of bytes(BODY_LENGTH * 2)) {
      if (byte < 252 && body.length < BODY_LENGTH) body += ALPHABET[byte % ALPHABET.length];
    }
  }
  if (body.length < BODY_LENGTH) throw new Error('not enough random bytes for a reference');
  return REFERENCE_PREFIX + body;
}

export function isValidReference(value: unknown): value is string {
  return typeof value === 'string' && SHAPE.test(value);
}
