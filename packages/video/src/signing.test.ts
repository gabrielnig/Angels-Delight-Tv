import { describe, expect, it } from 'vitest';
import { SIGNING_TEST_VECTOR, signMediaKey, signedMediaUrl, verifyMediaSignature } from './signing';

const secret = new Uint8Array(32).fill(7);
const key = 'v/abcdefghijklmnopqrstuvwx/720/seg_00001.ts';

describe('signed media urls', () => {
  it('matches the shared test vector the edge worker also checks', () => {
    expect(
      signMediaKey(SIGNING_TEST_VECTOR.secret, SIGNING_TEST_VECTOR.key, SIGNING_TEST_VECTOR.exp),
    ).toBe(SIGNING_TEST_VECTOR.sig);
  });

  it('builds url with exp and sig under the origin, keeping an origin base path', () => {
    const url = new URL(
      signedMediaUrl({ origin: 'https://video.example.com', key, secret, exp: 2_000_000_000 }),
    );
    expect(url.pathname).toBe(`/${key}`);
    expect(url.searchParams.get('exp')).toBe('2000000000');
    const dev = new URL(
      signedMediaUrl({ origin: 'http://localhost:9000/ad-media', key, secret, exp: 2_000_000_000 }),
    );
    expect(dev.pathname).toBe(`/ad-media/${key}`);
  });

  it('verifies a good signature and rejects tampering, other keys and expiry', () => {
    const exp = 1_000_100;
    const sig = signMediaKey(secret, key, exp);
    expect(verifyMediaSignature(secret, key, exp, sig, 1_000_000)).toBe(true);
    expect(verifyMediaSignature(secret, key.replace('720', '360'), exp, sig, 1_000_000)).toBe(
      false,
    );
    expect(verifyMediaSignature(secret, key, exp + 1, sig, 1_000_000)).toBe(false);
    expect(verifyMediaSignature(new Uint8Array(32).fill(8), key, exp, sig, 1_000_000)).toBe(false);
    expect(verifyMediaSignature(secret, key, exp, sig.slice(0, -2), 1_000_000)).toBe(false);
  });

  it('allows 30 seconds of clock skew after expiry, not more', () => {
    const exp = 1_000_000;
    const sig = signMediaKey(secret, key, exp);
    expect(verifyMediaSignature(secret, key, exp, sig, exp + 30)).toBe(true);
    expect(verifyMediaSignature(secret, key, exp, sig, exp + 31)).toBe(false);
  });
});
