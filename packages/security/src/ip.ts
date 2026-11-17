import { isIPv4, isIPv6 } from 'node:net';

export type TrustedProxyMode = 'none' | 'cloudflare';

/** IPv4 to /24, IPv6 to /48 (SECURITY.md section 10). Returns null for anything that is not an address. */
export function truncateIp(ip: string): string | null {
  const value = ip.trim();
  if (isIPv4(value)) {
    const [a, b, c] = value.split('.');
    return `${a}.${b}.${c}.0/24`;
  }
  if (!isIPv6(value)) return null;
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(value);
  if (mapped?.[1] && isIPv4(mapped[1])) return truncateIp(mapped[1]);
  const groups = expandIpv6(value).slice(0, 3);
  return `${groups.join(':')}::/48`;
}

function expandIpv6(ip: string): string[] {
  const [head = '', tail] = ip.split('::');
  const headGroups = head ? head.split(':') : [];
  const tailGroups = tail ? tail.split(':') : [];
  const missing = 8 - headGroups.length - tailGroups.length;
  const groups =
    tail === undefined ? headGroups : [...headGroups, ...Array(missing).fill('0'), ...tailGroups];
  return groups.map((group) => group.toLowerCase().replace(/^0+(?=.)/, ''));
}

/**
 * The caller address, or null when it cannot be trusted. Forwarding headers are spoofable, so only
 * CF-Connecting-IP is read, and only when the origin is firewalled to Cloudflare (TRUSTED_PROXY_MODE=cloudflare).
 */
export function clientIp(headers: Headers, mode: TrustedProxyMode): string | null {
  if (mode !== 'cloudflare') return null;
  const value = headers.get('cf-connecting-ip')?.trim();
  return value && (isIPv4(value) || isIPv6(value)) ? value : null;
}
