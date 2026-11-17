import { randomBytes } from 'node:crypto';

export type RandomSource = (byteLength: number) => Uint8Array;

export interface IdOptions {
  now?: () => number;
  random?: RandomSource;
}

const systemRandom: RandomSource = (n) => randomBytes(n);

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}

/** UUIDv7 (RFC 9562): 48 bit unix millisecond timestamp, then random bits. Sorts by creation time. */
export function uuidv7(options: IdOptions = {}): string {
  const now = options.now ?? Date.now;
  const random = options.random ?? systemRandom;
  const bytes = new Uint8Array(16);
  bytes.set(random(10), 6);

  let ms = now();
  for (let i = 5; i >= 0; i--) {
    bytes[i] = ms % 256;
    ms = Math.floor(ms / 256);
  }
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x70;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;

  const hex = Buffer.from(bytes).toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function uuidv7Timestamp(id: string): number {
  return parseInt(id.replace(/-/g, '').slice(0, 12), 16);
}

const BASE32_ALPHABET = 'abcdefghijklmnopqrstuvwxyz234567';

/** Lowercase RFC 4648 base32 without padding, so output is safe in URLs and object keys. */
export function base32Random(byteLength: number, random: RandomSource = systemRandom): string {
  const bytes = random(byteLength);
  let bits = 0;
  let value = 0;
  let out = '';
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
    value &= (1 << bits) - 1;
  }
  if (bits > 0) {
    out += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }
  return out;
}

/** The unguessable path part of a video's media keys (DATA-MODEL videos.media_prefix). */
export function mediaPrefix(random: RandomSource = systemRandom): string {
  return base32Random(16, random);
}
