import { describe, expect, it } from 'vitest';
import { emailHash, maskEmail, normalizeEmail } from './identifiers';

const pepper = new Uint8Array(32).fill(7);

describe('normalizeEmail', () => {
  it('trims and lowercases the whole address', () => {
    expect(normalizeEmail('  Tobi.Adeyemi@Example.COM ')).toBe('tobi.adeyemi@example.com');
  });

  it('keeps plus addressing', () => {
    expect(normalizeEmail('a+b@x.com')).toBe('a+b@x.com');
  });

  it('rejects malformed addresses', () => {
    for (const bad of ['', 'plain', 'a@', '@b.com', 'a b@c.com', 'a@b', 'a@@b.com', 'a@b.com\r\nBcc: x@y.z']) {
      expect(normalizeEmail(bad), bad).toBeNull();
    }
  });

  it('rejects addresses over 254 characters', () => {
    expect(normalizeEmail(`${'a'.repeat(250)}@b.co`)).toBeNull();
  });
});

describe('emailHash', () => {
  it('is a stable 32 byte keyed hash of the normalised address', () => {
    const one = emailHash('tobi@example.com', pepper);
    expect(one).toHaveLength(32);
    expect(Buffer.from(one).equals(Buffer.from(emailHash('tobi@example.com', pepper)))).toBe(true);
  });

  it('depends on the pepper', () => {
    const other = new Uint8Array(32).fill(8);
    expect(Buffer.from(emailHash('a@b.co', pepper)).equals(Buffer.from(emailHash('a@b.co', other)))).toBe(false);
  });
});

describe('maskEmail', () => {
  it('keeps the first letter and the domain', () => {
    expect(maskEmail('tobi@gmail.com')).toBe('t***@gmail.com');
    expect(maskEmail('a@gmail.com')).toBe('a***@gmail.com');
  });
});
