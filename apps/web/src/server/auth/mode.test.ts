import { describe, expect, it } from 'vitest';
import { realAuthEnabled } from './mode';

const secrets = { DATABASE_URL: 'postgres://x', FIELD_KEK: 'k', EMAIL_HASH_PEPPER: 'p' };

describe('realAuthEnabled', () => {
  it('is on when the secrets are present and nothing forces fixtures', () => {
    expect(realAuthEnabled({ ...secrets, NODE_ENV: 'development' })).toBe(true);
  });
  it('falls back to fixtures in development when secrets are missing', () => {
    expect(realAuthEnabled({ NODE_ENV: 'development' })).toBe(false);
  });
  it('can be forced either way with AUTH_FIXTURES', () => {
    expect(realAuthEnabled({ ...secrets, AUTH_FIXTURES: 'on' })).toBe(false);
    expect(realAuthEnabled({ NODE_ENV: 'development', AUTH_FIXTURES: 'off' })).toBe(true);
  });
  it('never uses fixtures in production, even if asked', () => {
    expect(realAuthEnabled({ NODE_ENV: 'production', AUTH_FIXTURES: 'on' })).toBe(true);
    expect(realAuthEnabled({ NODE_ENV: 'production' })).toBe(true);
  });
});
