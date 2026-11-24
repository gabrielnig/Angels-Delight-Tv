import { describe, expect, it } from 'vitest';
import { isValidReference, newReference, REFERENCE_PREFIX } from './reference';

describe('references', () => {
  it('use only characters Paystack allows and a fixed shape', () => {
    const ref = newReference();
    expect(ref).toMatch(/^ad-don-[a-z0-9]{20}$/);
    expect(ref.startsWith(REFERENCE_PREFIX)).toBe(true);
    expect(ref).toMatch(/^[A-Za-z0-9.=-]+$/);
  });
  it('are unique across many calls', () => {
    const seen = new Set(Array.from({ length: 5000 }, () => newReference()));
    expect(seen.size).toBe(5000);
  });
  it('carry no personal data, they come only from random bytes', () => {
    const fixed = new Uint8Array(20).fill(7);
    const a = newReference(() => fixed);
    const b = newReference(() => fixed);
    expect(a).toBe(b);
    expect(a.length).toBe(REFERENCE_PREFIX.length + 20);
  });
  it('validates the shape of a reference we issued', () => {
    expect(isValidReference(newReference())).toBe(true);
    for (const bad of ['', 'ad_don_abcdefghijklmnopqrst', 'ad-don-SHORT', 'ad-don-' + 'a'.repeat(21), 'x-don-' + 'a'.repeat(20), 'ad-don-abc def ghijklmnopqr']) {
      expect(isValidReference(bad)).toBe(false);
    }
    expect(isValidReference(undefined)).toBe(false);
  });
});
