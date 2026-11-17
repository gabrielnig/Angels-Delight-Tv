import { base32Random, hmacSha256 } from '@ad/shared';
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import QRCode from 'qrcode';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const PERIOD_MS = 30_000;

export function base32Encode(bytes: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let out = '';
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
    value &= (1 << bits) - 1;
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(text: string): Uint8Array {
  const clean = text.replace(/[\s=]/g, '').toUpperCase();
  const bytes: number[] = [];
  let bits = 0;
  let value = 0;
  for (const char of clean) {
    const index = ALPHABET.indexOf(char);
    if (index < 0) throw new Error('Invalid base32');
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return new Uint8Array(bytes);
}

/** 160 bit secret, the size authenticator apps expect. */
export const generateTotpSecret = (): Uint8Array => new Uint8Array(randomBytes(20));

function hotp(secret: Uint8Array, counter: number): string {
  const message = Buffer.alloc(8);
  message.writeBigUInt64BE(BigInt(counter));
  const digest = createHmac('sha1', secret).update(message).digest();
  const offset = (digest[digest.length - 1] ?? 0) & 0x0f;
  const binary =
    (((digest[offset] ?? 0) & 0x7f) << 24) |
    (((digest[offset + 1] ?? 0) & 0xff) << 16) |
    (((digest[offset + 2] ?? 0) & 0xff) << 8) |
    ((digest[offset + 3] ?? 0) & 0xff);
  return String(binary % 1_000_000).padStart(6, '0');
}

export const totpAt = (secret: Uint8Array, timeMs: number): string =>
  hotp(secret, Math.floor(timeMs / PERIOD_MS));

export type TotpCheck = { ok: true; step: number } | { ok: false };

/**
 * Accepts the current 30 second step and one step either side (clock drift, M12-S02). A step at or below
 * `lastUsedStep` is refused, so a code seen once cannot be replayed inside its window.
 */
export function verifyTotp(
  secret: Uint8Array,
  code: string,
  nowMs: number,
  options: { lastUsedStep?: number | null; window?: number } = {},
): TotpCheck {
  if (!/^\d{6}$/.test(code)) return { ok: false };
  const current = Math.floor(nowMs / PERIOD_MS);
  const window = options.window ?? 1;
  const given = Buffer.from(code);
  let matched: number | null = null;
  // Every step is compared, so timing does not show which one matched.
  for (let step = current - window; step <= current + window; step++) {
    const expected = Buffer.from(hotp(secret, step));
    if (timingSafeEqual(expected, given) && matched === null) matched = step;
  }
  if (matched === null) return { ok: false };
  const last = options.lastUsedStep;
  if (last !== null && last !== undefined && matched <= last) return { ok: false };
  return { ok: true, step: matched };
}

export function otpauthUri(input: { secret: Uint8Array; account: string; issuer: string }): string {
  const issuer = encodeURIComponent(input.issuer);
  const label = `${issuer}:${encodeURIComponent(input.account)}`;
  return `otpauth://totp/${label}?secret=${base32Encode(input.secret)}&issuer=${issuer}&algorithm=SHA1&digits=6&period=30`;
}

export function qrSvg(text: string): Promise<string> {
  return QRCode.toString(text, { type: 'svg', margin: 1, errorCorrectionLevel: 'M' });
}

export function generateRecoveryCodes(count = 10): string[] {
  const codes = new Set<string>();
  while (codes.size < count) {
    const raw = base32Random(7).slice(0, 10);
    codes.add(`${raw.slice(0, 5)}-${raw.slice(5)}`);
  }
  return [...codes];
}

export function normalizeRecoveryCode(input: string): string | null {
  const clean = input.trim().toLowerCase().replace(/[\s-]/g, '');
  return /^[a-z2-7]{10}$/.test(clean) ? `${clean.slice(0, 5)}-${clean.slice(5)}` : null;
}

export const hashRecoveryCode = (pepper: Uint8Array, code: string): Uint8Array =>
  hmacSha256(pepper, `recovery:${code}`);
