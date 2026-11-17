import { Forbidden } from '@ad/shared';
import { describe, expect, it } from 'vitest';
import { buildMeta, sameOriginOr403 } from './request';

describe('buildMeta', () => {
  it('truncates the trusted client address and keeps the request id and agent', () => {
    const headers = new Headers({
      'cf-connecting-ip': '203.0.113.77',
      'user-agent': 'Mozilla/5.0',
      'x-request-id': 'req-9',
    });
    expect(buildMeta(headers, 'cloudflare')).toEqual({
      ip: '203.0.113.77',
      ipTrunc: '203.0.113.0/24',
      userAgent: 'Mozilla/5.0',
      requestId: 'req-9',
    });
  });

  it('has no address when no trusted proxy is configured, even with spoofed headers', () => {
    const meta = buildMeta(
      new Headers({ 'x-forwarded-for': '198.51.100.1', 'cf-connecting-ip': '203.0.113.1' }),
      'none',
    );
    expect(meta.ip).toBeNull();
    expect(meta.ipTrunc).toBeNull();
  });

  it('caps the user agent at 200 characters', () => {
    expect(
      buildMeta(new Headers({ 'user-agent': 'x'.repeat(400) }), 'none').userAgent,
    ).toHaveLength(200);
  });
});

describe('sameOriginOr403', () => {
  it('returns a 403 response for a cross origin post and null for a same origin one', () => {
    const bad = sameOriginOr403(
      new Headers({ origin: 'https://evil.example' }),
      'https://tv.example.org',
    );
    expect(bad?.status).toBe(403);
    expect(
      sameOriginOr403(new Headers({ origin: 'https://tv.example.org' }), 'https://tv.example.org'),
    ).toBeNull();
    expect(() => {
      throw new Forbidden();
    }).toThrow();
  });
});
