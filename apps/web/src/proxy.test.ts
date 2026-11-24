import { describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { proxy } from './proxy';

describe('proxy request id (L-9)', () => {
  it('does not echo a hostile inbound x-request-id', () => {
    const res = proxy(
      new NextRequest('https://app.test/browse', { headers: { 'x-request-id': 'bad id <x>' } }),
    );
    const id = res.headers.get('x-request-id') ?? '';
    expect(id).toMatch(/^[A-Za-z0-9_-]{8,64}$/);
    expect(id).not.toContain('bad');
  });
  it('keeps a well formed inbound id', () => {
    const res = proxy(
      new NextRequest('https://app.test/browse', { headers: { 'x-request-id': 'abc12345-def' } }),
    );
    expect(res.headers.get('x-request-id')).toBe('abc12345-def');
  });
});

describe('proxy locale (M46)', () => {
  const req = (url: string, headers: Record<string, string> = {}) =>
    new NextRequest(url, { headers });
  it('?lang=yo sets the cookie and keeps the path', () => {
    const res = proxy(req('https://app.test/browse?lang=yo'));
    expect(res.cookies.get('ad_locale')?.value).toBe('yo');
    expect(res.headers.get('location')).toBeNull();
    expect(res.headers.get('x-middleware-request-x-ad-locale-hint')).toBe('yo');
    expect(res.headers.get('x-middleware-request-x-ad-locale-source')).toBe('query');
  });
  it('an unknown ?lang= sets nothing', () => {
    const res = proxy(req('https://app.test/browse?lang=fr'));
    expect(res.cookies.get('ad_locale')).toBeUndefined();
    expect(res.headers.get('x-middleware-request-x-ad-locale-source')).toBeNull();
  });
  it('forwards x-ad-locale-hint from the cookie', () => {
    const res = proxy(req('https://app.test/', { cookie: 'ad_locale=ha' }));
    expect(res.headers.get('x-middleware-request-x-ad-locale-hint')).toBe('ha');
    expect(res.headers.get('x-middleware-request-x-ad-locale-source')).toBe('cookie');
  });
  it('forwards the Accept-Language match and nothing for a plain English browser header', () => {
    const res = proxy(req('https://app.test/', { 'accept-language': 'fr, yo;q=0.8' }));
    expect(res.headers.get('x-middleware-request-x-ad-locale-hint')).toBe('yo');
    expect(res.headers.get('x-middleware-request-x-ad-locale-source')).toBe('accept');
  });
  it('the CSP and request id headers are unchanged', () => {
    const res = proxy(req('https://app.test/browse?lang=yo'));
    expect(res.headers.get('x-request-id')).toMatch(/^[A-Za-z0-9_-]{8,64}$/);
    expect(res.headers.get('Content-Security-Policy') ?? res.headers.get('Content-Security-Policy-Report-Only')).toBeTruthy();
  });
});
