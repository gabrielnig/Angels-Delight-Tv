import { describe, expect, it } from 'vitest';
import { chooseTranslator } from './translator';

const base = { TRANSLATE_PROVIDER: 'none', TRANSLATE_API_KEY: undefined } as const;

describe('chooseTranslator', () => {
  it('provider none is a permanent not configured error', async () => {
    const t = chooseTranslator(base);
    await expect(t.translate({ source: 'en', target: 'yo', texts: ['a'] })).rejects.toMatchObject({ permanent: true });
    expect(t.supports('en', 'yo')).toBe(false);
  });
  it('fake returns tagged text', async () => {
    const t = chooseTranslator({ ...base, TRANSLATE_PROVIDER: 'fake' });
    expect((await t.translate({ source: 'en', target: 'yo', texts: ['a'] })).texts).toEqual(['[yo] a']);
  });
  it('google builds the API adapter', () => {
    expect(chooseTranslator({ TRANSLATE_PROVIDER: 'google', TRANSLATE_API_KEY: 'k' }).name).toBe('google');
  });
});
