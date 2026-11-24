import { describe, expect, it } from 'vitest';
import { translationCapability } from './capability';

describe('translationCapability', () => {
  it('provider none offers nothing', () => {
    expect(translationCapability('none')).toBeUndefined();
  });
  it('google supports the four listed languages and has a price for the estimate', () => {
    const c = translationCapability('google')!;
    expect(c.name).toBe('google');
    expect(c.supports('en', 'yo')).toBe(true);
    expect(c.supports('en', 'ha')).toBe(true);
    expect(c.supports('en', 'pcm')).toBe(false);
    expect(c.usdPerMillionChars).toBe(20);
  });
  it('fake supports every pair and costs nothing', () => {
    const c = translationCapability('fake')!;
    expect(c.supports('en', 'pcm')).toBe(true);
    expect(c.usdPerMillionChars ?? null).toBeNull();
  });
});
