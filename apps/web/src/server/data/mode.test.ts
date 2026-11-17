import { describe, expect, it } from 'vitest';
import { realDataEnabled } from './mode';

const secrets = { DATABASE_URL: 'postgres://x', FIELD_KEK: 'k', EMAIL_HASH_PEPPER: 'p' };

describe('realDataEnabled', () => {
  it('follows real auth when nothing forces fixtures', () => {
    expect(realDataEnabled({ ...secrets, NODE_ENV: 'development' })).toBe(true);
    expect(realDataEnabled({ NODE_ENV: 'development' })).toBe(false);
  });
  it('can switch viewer data to fixtures outside production', () => {
    expect(realDataEnabled({ ...secrets, NODE_ENV: 'development', VIEWER_FIXTURES: 'on' })).toBe(
      false,
    );
    expect(realDataEnabled({ ...secrets, NODE_ENV: 'test', VIEWER_FIXTURES: 'on' })).toBe(false);
  });
  it('is never real when auth is fixtures, because fixture accounts are not database rows', () => {
    expect(realDataEnabled({ ...secrets, NODE_ENV: 'development', AUTH_FIXTURES: 'on' })).toBe(
      false,
    );
  });
  it('ignores the fixture flag in production', () => {
    expect(realDataEnabled({ NODE_ENV: 'production', VIEWER_FIXTURES: 'on' })).toBe(true);
    expect(
      realDataEnabled({ NODE_ENV: 'production', AUTH_FIXTURES: 'on', VIEWER_FIXTURES: 'on' }),
    ).toBe(true);
  });
});
