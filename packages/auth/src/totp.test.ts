import { describe, expect, it } from 'vitest';
import {
  base32Decode,
  base32Encode,
  generateRecoveryCodes,
  generateTotpSecret,
  hashRecoveryCode,
  normalizeRecoveryCode,
  otpauthUri,
  qrSvg,
  totpAt,
  verifyTotp,
} from './totp';

const rfcSecret = new TextEncoder().encode('12345678901234567890');

describe('totp', () => {
  it('matches the RFC 6238 SHA-1 test vectors', () => {
    const vectors: Array<[number, string]> = [
      [59, '287082'],
      [1111111109, '081804'],
      [1111111111, '050471'],
      [1234567890, '005924'],
      [2000000000, '279037'],
      [20000000000, '353130'],
    ];
    for (const [seconds, code] of vectors) {
      expect(totpAt(rfcSecret, seconds * 1000), `t=${seconds}`).toBe(code);
    }
  });

  it('round trips base32 and rejects bad characters', () => {
    const secret = generateTotpSecret();
    expect(secret).toHaveLength(20);
    expect(Buffer.from(base32Decode(base32Encode(secret))).equals(Buffer.from(secret))).toBe(true);
    expect(base32Encode(rfcSecret)).toBe('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ');
    expect(() => base32Decode('not*base32')).toThrow();
  });

  it('accepts the current step and one step of drift either way, not two', () => {
    const now = 1_700_000_000_000;
    const step = Math.floor(now / 30_000);
    const at = (s: number) => totpAt(rfcSecret, s * 30_000);
    expect(verifyTotp(rfcSecret, at(step), now)).toEqual({ ok: true, step });
    expect(verifyTotp(rfcSecret, at(step - 1), now)).toEqual({ ok: true, step: step - 1 });
    expect(verifyTotp(rfcSecret, at(step + 1), now)).toEqual({ ok: true, step: step + 1 });
    expect(verifyTotp(rfcSecret, at(step - 2), now).ok).toBe(false);
    expect(verifyTotp(rfcSecret, at(step + 2), now).ok).toBe(false);
  });

  it('refuses a step that was already used, which stops replay', () => {
    const now = 1_700_000_000_000;
    const step = Math.floor(now / 30_000);
    const code = totpAt(rfcSecret, now);
    expect(verifyTotp(rfcSecret, code, now, { lastUsedStep: step }).ok).toBe(false);
    expect(verifyTotp(rfcSecret, code, now, { lastUsedStep: step - 1 })).toEqual({
      ok: true,
      step,
    });
  });

  it('rejects malformed codes without computing anything', () => {
    for (const bad of ['', '12345', '1234567', 'abcdef', '12 456']) {
      expect(verifyTotp(rfcSecret, bad, 0).ok).toBe(false);
    }
  });

  it('builds an otpauth uri an authenticator app can scan', () => {
    const uri = otpauthUri({
      secret: rfcSecret,
      account: 'vanessa@example.org',
      issuer: 'Angels Delight TV',
    });
    expect(uri).toBe(
      'otpauth://totp/Angels%20Delight%20TV:vanessa%40example.org?secret=GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ&issuer=Angels%20Delight%20TV&algorithm=SHA1&digits=6&period=30',
    );
  });

  it('renders the uri as an inline svg qr code', async () => {
    const svg = await qrSvg('otpauth://totp/x?secret=ABC');
    expect(svg.startsWith('<svg')).toBe(true);
    expect(svg).not.toContain('<script');
  });
});

describe('recovery codes', () => {
  it('makes ten distinct codes with enough entropy', () => {
    const codes = generateRecoveryCodes();
    expect(codes).toHaveLength(10);
    expect(new Set(codes).size).toBe(10);
    for (const code of codes) expect(code).toMatch(/^[a-z2-7]{5}-[a-z2-7]{5}$/);
  });

  it('normalises typed codes and hashes them with the pepper', () => {
    expect(normalizeRecoveryCode(' ABCDE-fghij ')).toBe('abcde-fghij');
    expect(normalizeRecoveryCode('abcdefghij')).toBe('abcde-fghij');
    expect(normalizeRecoveryCode('short')).toBeNull();
    const pepper = new Uint8Array(32).fill(1);
    const a = Buffer.from(hashRecoveryCode(pepper, 'abcde-fghij'));
    expect(a.equals(Buffer.from(hashRecoveryCode(pepper, 'abcde-fghij')))).toBe(true);
    expect(a.equals(Buffer.from(hashRecoveryCode(new Uint8Array(32).fill(2), 'abcde-fghij')))).toBe(
      false,
    );
  });
});
