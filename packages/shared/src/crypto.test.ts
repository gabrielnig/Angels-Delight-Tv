import { describe, expect, it } from 'vitest';
import {
  constantTimeEqual,
  decryptAesGcm,
  encryptAesGcm,
  hmacSha256,
  randomToken,
  sha256,
} from './crypto';

const key = new Uint8Array(32).fill(7);

describe('sha256', () => {
  it('matches the known digest of "abc"', () => {
    expect(Buffer.from(sha256('abc')).toString('hex')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });
});

describe('hmacSha256', () => {
  it('matches the RFC 4231 test case 2', () => {
    const mac = hmacSha256(new TextEncoder().encode('Jefe'), 'what do ya want for nothing?');
    expect(Buffer.from(mac).toString('hex')).toBe(
      '5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843',
    );
  });

  it('changes when the key changes', () => {
    expect(hmacSha256(key, 'x')).not.toEqual(hmacSha256(new Uint8Array(32).fill(8), 'x'));
  });
});

describe('constantTimeEqual', () => {
  it('is true for equal bytes and false for different bytes', () => {
    expect(constantTimeEqual(new Uint8Array([1, 2]), new Uint8Array([1, 2]))).toBe(true);
    expect(constantTimeEqual(new Uint8Array([1, 2]), new Uint8Array([1, 3]))).toBe(false);
  });

  it('is false for different lengths instead of throwing', () => {
    expect(constantTimeEqual(new Uint8Array([1]), new Uint8Array([1, 2]))).toBe(false);
  });
});

describe('randomToken', () => {
  it('returns url safe base64 of the requested byte length', () => {
    const token = randomToken(32);
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(randomToken(32)).not.toBe(token);
  });

  it('uses the injected random source', () => {
    const zeros = (n: number) => new Uint8Array(n);
    expect(randomToken(3, zeros)).toBe('AAAA');
  });
});

describe('AES-256-GCM', () => {
  const aad = new TextEncoder().encode('account-1');

  it('round trips a plaintext', () => {
    const sealed = encryptAesGcm(key, new TextEncoder().encode('secret'), aad);
    expect(new TextDecoder().decode(decryptAesGcm(key, sealed, aad))).toBe('secret');
  });

  it('uses a fresh nonce so equal plaintexts give different ciphertexts', () => {
    const a = encryptAesGcm(key, new Uint8Array([1]), aad);
    const b = encryptAesGcm(key, new Uint8Array([1]), aad);
    expect(Buffer.from(a).equals(Buffer.from(b))).toBe(false);
  });

  it('fails with the wrong key', () => {
    const sealed = encryptAesGcm(key, new Uint8Array([1]), aad);
    expect(() => decryptAesGcm(new Uint8Array(32).fill(9), sealed, aad)).toThrow();
  });

  it('fails when the associated data differs', () => {
    const sealed = encryptAesGcm(key, new Uint8Array([1]), aad);
    expect(() => decryptAesGcm(key, sealed, new TextEncoder().encode('account-2'))).toThrow();
  });

  it('fails when the ciphertext is tampered with', () => {
    const sealed = encryptAesGcm(key, new Uint8Array([1, 2, 3]), aad);
    sealed[sealed.length - 1] = (sealed[sealed.length - 1] ?? 0) ^ 1;
    expect(() => decryptAesGcm(key, sealed, aad)).toThrow();
  });

  it('rejects a key that is not 32 bytes', () => {
    expect(() => encryptAesGcm(new Uint8Array(16), new Uint8Array([1]), aad)).toThrow(/32 bytes/);
  });

  it('rejects input shorter than nonce plus tag', () => {
    expect(() => decryptAesGcm(key, new Uint8Array(10), aad)).toThrow(/too short/);
  });
});
