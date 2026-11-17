import { describe, expect, it } from 'vitest';
import { generateCode, generateToken, hashCode, hashToken, tokensMatch } from './tokens';

describe('tokens', () => {
  it('generates 256 bit url safe tokens', () => {
    const token = generateToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(generateToken()).not.toBe(token);
  });

  it('stores only the sha256 of a token', () => {
    const hash = hashToken('abc');
    expect(hash).toHaveLength(32);
    expect(Buffer.from(hash).toString('hex')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });

  it('compares hashes in constant time and rejects length mismatches', () => {
    expect(tokensMatch(hashToken('a'), hashToken('a'))).toBe(true);
    expect(tokensMatch(hashToken('a'), hashToken('b'))).toBe(false);
    expect(tokensMatch(hashToken('a'), new Uint8Array(5))).toBe(false);
  });

  it('generates six digit codes including leading zeros', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 200; i++) {
      const code = generateCode();
      expect(code).toMatch(/^\d{6}$/);
      seen.add(code);
    }
    expect(seen.size).toBeGreaterThan(150);
    expect(generateCode(() => 42)).toBe('000042');
  });

  it('binds a code hash to the account and the pepper', () => {
    const pepper = new Uint8Array(32).fill(1);
    const base = Buffer.from(hashCode(pepper, 'acct-1', '123456'));
    expect(base.equals(Buffer.from(hashCode(pepper, 'acct-1', '123456')))).toBe(true);
    expect(base.equals(Buffer.from(hashCode(pepper, 'acct-2', '123456')))).toBe(false);
    expect(base.equals(Buffer.from(hashCode(pepper, 'acct-1', '123457')))).toBe(false);
  });
});
