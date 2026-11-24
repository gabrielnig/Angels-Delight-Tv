import type { RequestMeta } from '@ad/auth';
import { type TrustedProxyMode, assertSameOrigin, clientIp, truncateIp } from '@ad/security';

/** Cloudflare sends XX for unknown and T1 for Tor. Only a plain two letter code is kept, and only from a trusted proxy. */
function trustedCountry(headers: Headers, mode: TrustedProxyMode): string | null {
  if (mode !== 'cloudflare') return null;
  const raw = headers.get('cf-ipcountry')?.trim().toUpperCase() ?? '';
  return /^[A-Z]{2}$/.test(raw) && raw !== 'XX' ? raw : null;
}

export function buildMeta(
  headers: Headers,
  mode: TrustedProxyMode,
  deviceId: string | null = null,
): RequestMeta {
  const ip = clientIp(headers, mode);
  return {
    ip,
    ipTrunc: ip ? truncateIp(ip) : null,
    userAgent: headers.get('user-agent')?.slice(0, 200) ?? null,
    requestId: headers.get('x-request-id'),
    country: trustedCountry(headers, mode),
    deviceId,
  };
}

/** For route handlers: a 403 response when the request is not same-origin, otherwise null. */
export function sameOriginOr403(headers: Headers, appOrigin: string): Response | null {
  try {
    assertSameOrigin(headers, appOrigin);
    return null;
  } catch {
    return new Response('Forbidden', { status: 403 });
  }
}
