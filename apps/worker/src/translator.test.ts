import { describe, expect, it } from 'vitest';
import { MemoryUsageStore } from '@ad/video';
import { chooseTranslator } from './translator';

const base = { TRANSLATE_PROVIDER: 'none', TRANSLATE_API_KEY: undefined, TRANSLATE_MONTHLY_CHAR_CAP: 0 } as const;

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
  it('google builds the API adapter behind the usage cap', () => {
    const env = { TRANSLATE_PROVIDER: 'google', TRANSLATE_API_KEY: 'k', TRANSLATE_MONTHLY_CHAR_CAP: 100 } as const;
    expect(chooseTranslator(env, new MemoryUsageStore()).name).toBe('google');
  });
  it('google with a cap of 0 refuses before any request', async () => {
    const env = { TRANSLATE_PROVIDER: 'google', TRANSLATE_API_KEY: 'k', TRANSLATE_MONTHLY_CHAR_CAP: 0 } as const;
    const t = chooseTranslator(env, new MemoryUsageStore());
    await expect(t.translate({ source: 'en', target: 'yo', texts: ['a'] })).rejects.toMatchObject({ permanent: true });
  });
  it('google without a usage store fails closed instead of running uncapped', async () => {
    const env = { TRANSLATE_PROVIDER: 'google', TRANSLATE_API_KEY: 'k', TRANSLATE_MONTHLY_CHAR_CAP: 100 } as const;
    const t = chooseTranslator(env);
    expect(t.supports('en', 'yo')).toBe(false);
    await expect(t.translate({ source: 'en', target: 'yo', texts: ['a'] })).rejects.toMatchObject({ permanent: true });
  });
  it('the fake engine is not capped', async () => {
    const t = chooseTranslator({ ...base, TRANSLATE_PROVIDER: 'fake' }, new MemoryUsageStore());
    await expect(t.translate({ source: 'en', target: 'yo', texts: ['a'] })).resolves.toBeDefined();
  });
});
