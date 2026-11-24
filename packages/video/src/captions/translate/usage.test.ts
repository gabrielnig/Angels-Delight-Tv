import { describe, expect, it } from 'vitest';
import { MemoryUsageStore, assertWithinCap, monthStart, withUsageCap } from './usage';

describe('assertWithinCap', () => {
  it('a cap of 0 disables API use', () => {
    expect(() => assertWithinCap({ used: 0, adding: 10, cap: 0 })).toThrow(/not allowed|disabled|cap/i);
  });
  it('a job that would cross the monthly cap is refused before any call', () => {
    expect(() => assertWithinCap({ used: 95_000, adding: 6_000, cap: 100_000 })).toThrow(/monthly/i);
  });
  it('a job under the cap passes', () => {
    expect(() => assertWithinCap({ used: 10, adding: 10, cap: 100 })).not.toThrow();
  });
});

describe('withUsageCap', () => {
  const api = (chars = 0) => ({
    name: 'google',
    calls: 0,
    supports: () => true,
    async translate(req: { texts: string[] }) {
      this.calls += 1;
      return { texts: req.texts, model: 'm', chars: chars || req.texts.join('').length };
    },
  });
  const now = () => new Date('2026-11-24T10:00:00Z');

  it('refuses a call that would cross the cap before the provider is called', async () => {
    const store = new MemoryUsageStore();
    await store.add('2026-11-01', 'google', 99_990);
    const inner = api();
    const t = withUsageCap(inner, { store, cap: 100_000, now });
    await expect(t.translate({ source: 'en', target: 'yo', texts: ['x'.repeat(20)] })).rejects.toMatchObject({
      permanent: true,
    });
    expect(inner.calls).toBe(0);
  });
  it('records the characters after a call, under the first of the month', async () => {
    const store = new MemoryUsageStore();
    const t = withUsageCap(api(), { store, cap: 1000, now });
    await t.translate({ source: 'en', target: 'yo', texts: ['hello'] });
    expect(await store.used('2026-11-01', 'google')).toBe(5);
  });
  it('counts a new month from zero', async () => {
    const store = new MemoryUsageStore();
    await store.add('2026-10-01', 'google', 999);
    const t = withUsageCap(api(), { store, cap: 1000, now });
    await expect(t.translate({ source: 'en', target: 'yo', texts: ['hello'] })).resolves.toBeDefined();
  });
  it('a cap of 0 refuses every call', async () => {
    const t = withUsageCap(api(), { store: new MemoryUsageStore(), cap: 0, now });
    await expect(t.translate({ source: 'en', target: 'yo', texts: ['a'] })).rejects.toThrow(/not allowed/);
  });
  it('does not record a failed call', async () => {
    const store = new MemoryUsageStore();
    const inner = { ...api(), translate: async () => Promise.reject(new Error('down')) };
    const t = withUsageCap(inner, { store, cap: 1000, now });
    await expect(t.translate({ source: 'en', target: 'yo', texts: ['hello'] })).rejects.toThrow('down');
    expect(await store.used('2026-11-01', 'google')).toBe(0);
  });
  it('keeps name and supports of the wrapped translator', () => {
    const t = withUsageCap(api(), { store: new MemoryUsageStore(), cap: 1, now });
    expect(t.name).toBe('google');
    expect(t.supports('en', 'yo')).toBe(true);
  });
});

describe('monthStart', () => {
  it('is the first day of the UTC month', () => {
    expect(monthStart(new Date('2026-12-31T23:59:59Z'))).toBe('2026-12-01');
  });
});
