import { describe, expect, it } from 'vitest';
import { safeViewerNext } from './next-param';

describe('safeViewerNext', () => {
  it('keeps same origin paths with a query', () => {
    expect(safeViewerNext('/title/intro-to-fractions')).toBe('/title/intro-to-fractions');
    expect(safeViewerNext('/browse?category=maths')).toBe('/browse?category=maths');
  });

  it('falls back to the profile picker for anything else', () => {
    for (const bad of [
      'https://evil.example',
      '//evil.example',
      '/\\evil.example',
      'javascript:alert(1)',
      '/%2F%2Fevil.example',
      '/a/../b',
      '',
      undefined,
      null,
      42,
      '/title/x\r\nSet-Cookie: a=b',
      '/sign-in',
      '/admin',
    ]) {
      expect(safeViewerNext(bad), String(bad)).toBe('/profiles');
    }
  });

  it('does not bounce between auth screens', () => {
    expect(safeViewerNext('/sign-up')).toBe('/profiles');
    expect(safeViewerNext('/verify-email')).toBe('/profiles');
  });

  it('refuses very long values', () => {
    expect(safeViewerNext(`/${'a'.repeat(600)}`)).toBe('/profiles');
  });
});
