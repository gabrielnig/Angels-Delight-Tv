import { describe, expect, it } from 'vitest';
import { makeReference } from './reference';

describe('makeReference (L4-11)', () => {
  it('is AD- plus four easy to read characters', () => {
    for (let i = 0; i < 200; i += 1) {
      expect(makeReference()).toMatch(/^AD-[0-9A-HJKMNP-TV-Z]{4}$/);
    }
  });

  it('uses the random source it is given, so tests are stable', () => {
    expect(makeReference(() => 0)).toBe('AD-0000');
    expect(makeReference(() => 0.999999)).toBe('AD-ZZZZ');
  });

  it('never contains the look alike letters I, L, O or U', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 500; i += 1) for (const ch of makeReference().slice(3)) seen.add(ch);
    for (const bad of ['I', 'L', 'O', 'U']) expect(seen.has(bad)).toBe(false);
  });
});
