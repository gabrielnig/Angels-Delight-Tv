import { afterEach, describe, expect, it, vi } from 'vitest';
import { fixtureDataAllowed, getStore } from './store';

afterEach(() => vi.unstubAllEnvs());

describe('fixture data guard', () => {
  it('is allowed in development and test', () => {
    expect(fixtureDataAllowed({ NODE_ENV: 'development' })).toBe(true);
    expect(fixtureDataAllowed({ NODE_ENV: 'test' })).toBe(true);
  });
  it('is refused in production unless switched on on purpose', () => {
    expect(fixtureDataAllowed({ NODE_ENV: 'production' })).toBe(false);
    expect(fixtureDataAllowed({ NODE_ENV: 'production', ADMIN_FIXTURES: 'on' })).toBe(true);
  });
  it('getStore throws in production so fake data is never served', () => {
    vi.stubEnv('NODE_ENV', 'production');
    expect(() => getStore()).toThrow(/fixture/i);
  });
  it('reseeds a store from an older build that lacks newer collections', () => {
    const holder = globalThis as unknown as Record<symbol, unknown>;
    const key = Symbol.for('ad.admin.fixture.store');
    holder[key] = { videos: [], categories: [], series: [], captions: {}, home: {}, audit: [] };
    const s = getStore();
    expect(Array.isArray(s.jobs)).toBe(true);
    expect(s.accounts).toEqual({});
  });
});
