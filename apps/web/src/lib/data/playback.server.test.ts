import { describe, expect, it } from 'vitest';
import { getTransport } from './playback.server';

const REAL = { DATABASE_URL: 'postgres://x', FIELD_KEK: 'k', EMAIL_HASH_PEPPER: 'p' };

describe('getTransport', () => {
  it('always uses the real routes in production', () => {
    expect(getTransport({ NODE_ENV: 'production', PLAYBACK_TRANSPORT: 'fixture' })).toBe('http');
  });

  it('follows real viewer data outside production, so a real title never gets a sample stream', () => {
    expect(getTransport({ NODE_ENV: 'development', ...REAL })).toBe('http');
    expect(getTransport({ NODE_ENV: 'development', ...REAL, VIEWER_FIXTURES: 'on' })).toBe(
      'fixture',
    );
    expect(getTransport({ NODE_ENV: 'development' })).toBe('fixture');
  });

  it('lets PLAYBACK_TRANSPORT decide outside production when it is set', () => {
    expect(getTransport({ NODE_ENV: 'development', PLAYBACK_TRANSPORT: 'http' })).toBe('http');
    expect(getTransport({ NODE_ENV: 'development', ...REAL, PLAYBACK_TRANSPORT: 'fixture' })).toBe(
      'fixture',
    );
  });
});
