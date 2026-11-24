import { describe, expect, it } from 'vitest';
import { assertSupportedLanguage } from './profiles';

describe('profile language', () => {
  it('accepts the supported codes and undefined', () => {
    for (const l of ['en', 'yo', 'ig', 'ha', 'pcm', undefined]) expect(() => assertSupportedLanguage(l)).not.toThrow();
  });
  it('saving an unsupported language is a field error', () => {
    try {
      assertSupportedLanguage('fr');
      throw new Error('no throw');
    } catch (e) {
      expect((e as { fields?: Record<string, string[]> }).fields).toHaveProperty('language');
    }
  });
});
