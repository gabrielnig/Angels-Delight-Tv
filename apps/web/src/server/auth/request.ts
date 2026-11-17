import type { RequestMeta } from '@ad/auth';
import { type TrustedProxyMode, assertSameOrigin, clientIp, truncateIp } from '@ad/security';

export function buildMeta(headers: Headers, mode: TrustedProxyMode): RequestMeta {
  const ip = clientIp(headers, mode);
  return {
    ip,
    ipTrunc: ip ? truncateIp(ip) : null,
    userAgent: headers.get('user-agent')?.slice(0, 200) ?? null,
    requestId: headers.get('x-request-id'),
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
