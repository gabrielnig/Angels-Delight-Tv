import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';
import type { RandomSource } from './ids';

const systemRandom: RandomSource = (n) => randomBytes(n);

const NONCE_BYTES = 12;
const TAG_BYTES = 16;

type Bytes = Uint8Array | string;

export function sha256(input: Bytes): Uint8Array {
  return new Uint8Array(createHash('sha256').update(input).digest());
}

export function hmacSha256(key: Uint8Array, input: Bytes): Uint8Array {
  return new Uint8Array(createHmac('sha256', key).update(input).digest());
}

export function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Url safe base64 token with `byteLength` bytes of entropy. */
export function randomToken(byteLength: number, random: RandomSource = systemRandom): string {
  return Buffer.from(random(byteLength)).toString('base64url');
}

function assertKey(key: Uint8Array): void {
  if (key.length !== 32) {
    throw new Error('AES-256-GCM key must be 32 bytes');
  }
}

/** Returns nonce (12) + ciphertext + tag (16). The associated data binds the value to its owner. */
export function encryptAesGcm(
  key: Uint8Array,
  plaintext: Uint8Array,
  associatedData: Uint8Array,
  random: RandomSource = systemRandom,
): Uint8Array {
  assertKey(key);
  const nonce = random(NONCE_BYTES);
  const cipher = createCipheriv('aes-256-gcm', key, nonce);
  cipher.setAAD(associatedData);
  const body = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  return new Uint8Array(Buffer.concat([nonce, body, cipher.getAuthTag()]));
}

export function decryptAesGcm(
  key: Uint8Array,
  sealed: Uint8Array,
  associatedData: Uint8Array,
): Uint8Array {
  assertKey(key);
  if (sealed.length < NONCE_BYTES + TAG_BYTES) {
    throw new Error('Sealed value too short');
  }
  const nonce = sealed.subarray(0, NONCE_BYTES);
  const tag = sealed.subarray(sealed.length - TAG_BYTES);
  const body = sealed.subarray(NONCE_BYTES, sealed.length - TAG_BYTES);
  const decipher = createDecipheriv('aes-256-gcm', key, nonce);
  decipher.setAAD(associatedData);
  decipher.setAuthTag(tag);
  return new Uint8Array(Buffer.concat([decipher.update(body), decipher.final()]));
}
