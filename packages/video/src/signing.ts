import { constantTimeEqual, hmacSha256 } from '@ad/shared';

/** Seconds a signed segment url stays valid after its `exp` to absorb clock skew (ARCHITECTURE section 10). */
export const SIGNATURE_SKEW_SECONDS = 30;

/** sig = base64url(HMAC_SHA256(MEDIA_URL_SECRET, key + "\n" + exp)), where key is the object key such as v/{prefix}/720/seg_00001.ts. */
export function signMediaKey(secret: Uint8Array, key: string, exp: number): string {
  return Buffer.from(hmacSha256(secret, `${key}\n${exp}`)).toString('base64url');
}

export function signedMediaUrl(options: {
  origin: string;
  key: string;
  secret: Uint8Array;
  exp: number;
}): string {
  const base = options.origin.replace(/\/+$/, '');
  const sig = signMediaKey(options.secret, options.key, options.exp);
  return `${base}/${options.key}?exp=${options.exp}&sig=${sig}`;
}

export function verifyMediaSignature(
  secret: Uint8Array,
  key: string,
  exp: number,
  sig: string,
  nowSeconds: number,
): boolean {
  if (!Number.isInteger(exp) || nowSeconds > exp + SIGNATURE_SKEW_SECONDS) return false;
  const expected = Buffer.from(signMediaKey(secret, key, exp));
  return constantTimeEqual(expected, Buffer.from(sig));
}

/** Shared with apps/edge so both sides prove they compute the same signature. */
export const SIGNING_TEST_VECTOR = {
  secret: new Uint8Array(32).fill(7),
  key: 'v/abcdefghijklmnopqrstuvwx/720/seg_00001.ts',
  exp: 2_000_000_000,
  sig: 'S_am_ugFl71sq4JIYdQ_S-o8LBg2cbplc98y6-gMKUo',
};
