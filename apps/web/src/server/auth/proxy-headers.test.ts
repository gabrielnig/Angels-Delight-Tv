import { describe, expect, it } from 'vitest';
import { isPrivatePath, proxyResponseHeaders } from './proxy-headers';

const env = {
  mediaOrigin: 'https://media.example.org',
  s3Endpoint: 'https://s3.example.org/bucket',
  isDevelopment: false,
  reportOnly: false,
  turnstile: false,
};

describe('isPrivatePath', () => {
  it('marks account, admin and auth screens private', () => {
    for (const p of [
      '/account',
      '/account/security',
      '/admin',
      '/admin/login',
      '/sign-in',
      '/reset-password',
      '/verify-email/confirm',
    ]) {
      expect(isPrivatePath(p), p).toBe(true);
    }
    expect(isPrivatePath('/browse')).toBe(false);
  });
});

describe('proxyResponseHeaders', () => {
  it('sets a nonce CSP and no-store on private paths', () => {
    const h = proxyResponseHeaders({ pathname: '/sign-in', nonce: 'abc', requestId: 'r1', ...env });
    expect(h['Content-Security-Policy']).toContain("'nonce-abc'");
    expect(h['Cache-Control']).toBe('private, no-store');
    expect(h['X-Request-Id']).toBe('r1');
  });

  it('allows the upload origin only on admin pages', () => {
    const admin = proxyResponseHeaders({
      pathname: '/admin/titles',
      nonce: 'n',
      requestId: 'r',
      ...env,
    });
    const viewer = proxyResponseHeaders({
      pathname: '/browse',
      nonce: 'n',
      requestId: 'r',
      ...env,
    });
    expect(admin['Content-Security-Policy']).toContain('https://s3.example.org');
    expect(viewer['Content-Security-Policy']).not.toContain('https://s3.example.org');
    expect(viewer['Cache-Control']).toBeUndefined();
  });

  it('uses the report only header when asked', () => {
    const h = proxyResponseHeaders({
      pathname: '/',
      nonce: 'n',
      requestId: 'r',
      ...env,
      reportOnly: true,
    });
    expect(h['Content-Security-Policy-Report-Only']).toBeDefined();
    expect(h['Content-Security-Policy']).toBeUndefined();
  });
});
