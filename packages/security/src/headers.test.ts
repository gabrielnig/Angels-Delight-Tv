import { describe, expect, it } from 'vitest';
import { buildCsp, buildSecurityHeaders } from './headers';

const base = {
  nonce: 'abc123',
  mediaOrigin: 'https://media.example.org',
  isDevelopment: false,
  admin: false,
};

describe('buildCsp', () => {
  it('uses the nonce with strict-dynamic and never unsafe-inline for scripts', () => {
    const csp = buildCsp(base);
    expect(csp).toContain("script-src 'self' 'nonce-abc123' 'strict-dynamic'");
    expect(csp).not.toContain("'unsafe-inline'");
  });

  it('locks down framing, objects, base and form targets', () => {
    const csp = buildCsp(base);
    for (const directive of [
      "frame-ancestors 'none'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      'upgrade-insecure-requests',
    ]) {
      expect(csp).toContain(directive);
    }
  });

  it('allows the media origin for images, media and connections', () => {
    const csp = buildCsp(base);
    expect(csp).toContain("img-src 'self' data: blob: https://media.example.org");
    expect(csp).toContain("media-src 'self' blob: https://media.example.org");
    expect(csp).toContain("connect-src 'self' https://media.example.org");
  });

  it('lets the Home hero clip load from the media origin on viewer pages', () => {
    // Hero preview clips are plain <video src> on the media origin (M41-S11), so media-src must keep listing it.
    for (const admin of [false, true]) {
      const media = buildCsp({ ...base, admin })
        .split(';')
        .map((part) => part.trim())
        .find((part) => part.startsWith('media-src'));
      expect(media).toContain('https://media.example.org');
    }
  });

  it('allows the upload origin only on admin pages', () => {
    const upload = 'https://uploads.example.org';
    expect(buildCsp({ ...base, uploadOrigin: upload, admin: false })).not.toContain(upload);
    expect(buildCsp({ ...base, uploadOrigin: upload, admin: true })).toContain(upload);
  });

  it('adds unsafe-eval only in development', () => {
    expect(buildCsp(base)).not.toContain('unsafe-eval');
    expect(buildCsp({ ...base, isDevelopment: true })).toContain("'unsafe-eval'");
  });

  it('skips upgrade-insecure-requests in development over http', () => {
    expect(buildCsp({ ...base, isDevelopment: true })).not.toContain('upgrade-insecure-requests');
  });

  it('points violation reports at the app', () => {
    expect(buildCsp(base)).toContain('report-uri /api/csp-report');
  });
});

describe('buildSecurityHeaders', () => {
  it('sets the full header set from SECURITY.md section 14', () => {
    const headers = buildSecurityHeaders(base);
    expect(headers['Content-Security-Policy']).toBeDefined();
    expect(headers['Strict-Transport-Security']).toBe('max-age=31536000; includeSubDomains');
    expect(headers['X-Content-Type-Options']).toBe('nosniff');
    expect(headers['Referrer-Policy']).toBe('strict-origin-when-cross-origin');
    expect(headers['Permissions-Policy']).toBe(
      'camera=(), microphone=(), geolocation=(), payment=()',
    );
    expect(headers['Cross-Origin-Opener-Policy']).toBe('same-origin');
  });

  it('uses the report-only header name when asked', () => {
    const headers = buildSecurityHeaders({ ...base, reportOnly: true });
    expect(headers['Content-Security-Policy-Report-Only']).toBeDefined();
    expect(headers['Content-Security-Policy']).toBeUndefined();
  });

  it('omits HSTS in development so localhost over http keeps working', () => {
    expect(
      buildSecurityHeaders({ ...base, isDevelopment: true })['Strict-Transport-Security'],
    ).toBeUndefined();
  });

  it('is exactly the policy it was before donations and sponsors: no Paystack or other new origin (M48, R25)', () => {
    const csp = buildCsp(base);
    expect(csp).toBe(
      [
        "default-src 'self'",
        "script-src 'self' 'nonce-abc123' 'strict-dynamic'",
        "style-src 'self' 'nonce-abc123'",
        'img-src \'self\' data: blob: https://media.example.org',
        "media-src 'self' blob: https://media.example.org",
        "font-src 'self'",
        "connect-src 'self' https://media.example.org",
        "worker-src 'self' blob:",
        "frame-src 'none'",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
        "frame-ancestors 'none'",
        'report-uri /api/csp-report',
        'upgrade-insecure-requests',
      ].join('; '),
    );
    expect(csp).not.toMatch(/paystack|flutterwave|googletagmanager/i);
  });
});
