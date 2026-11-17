import { describe, expect, it } from 'vitest';
import { clientIp, truncateIp } from './ip';

describe('truncateIp', () => {
  it('keeps the /24 of an IPv4 address', () => {
    expect(truncateIp('203.0.113.77')).toBe('203.0.113.0/24');
  });

  it('keeps the /48 of an IPv6 address', () => {
    expect(truncateIp('2001:db8:abcd:12:3456:789a:bcde:f012')).toBe('2001:db8:abcd::/48');
  });

  it('expands a compressed IPv6 address before truncating', () => {
    expect(truncateIp('2001:db8::1')).toBe('2001:db8:0::/48');
  });

  it('unwraps an IPv4 mapped IPv6 address', () => {
    expect(truncateIp('::ffff:198.51.100.9')).toBe('198.51.100.0/24');
  });

  it('returns null for garbage', () => {
    expect(truncateIp('not an ip')).toBeNull();
    expect(truncateIp('')).toBeNull();
  });
});

describe('clientIp', () => {
  const headers = new Headers({
    'cf-connecting-ip': '203.0.113.5',
    'x-forwarded-for': '198.51.100.1, 10.0.0.1',
  });

  it('reads CF-Connecting-IP only when the cloudflare proxy mode is on', () => {
    expect(clientIp(headers, 'cloudflare')).toBe('203.0.113.5');
  });

  it('ignores spoofable forwarding headers when no trusted proxy is configured', () => {
    expect(clientIp(headers, 'none')).toBeNull();
  });

  it('returns null when the trusted header is missing or malformed', () => {
    expect(clientIp(new Headers(), 'cloudflare')).toBeNull();
    expect(clientIp(new Headers({ 'cf-connecting-ip': 'nope' }), 'cloudflare')).toBeNull();
  });
});
