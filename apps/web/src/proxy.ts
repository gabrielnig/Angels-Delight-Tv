import { type NextRequest, NextResponse } from 'next/server';
import { proxyResponseHeaders } from './server/auth/proxy-headers';

/** Nonce CSP, security headers and request ids (SECURITY.md sections 4 and 14). Reads process.env directly. */
export function proxy(request: NextRequest) {
  const nonce = btoa(crypto.randomUUID());
  const requestId = request.headers.get('x-request-id') ?? crypto.randomUUID();
  const headers = proxyResponseHeaders({
    pathname: request.nextUrl.pathname,
    nonce,
    requestId,
    mediaOrigin: process.env.MEDIA_ORIGIN
      ? new URL(process.env.MEDIA_ORIGIN).origin
      : "'self'",
    s3Endpoint: process.env.S3_ENDPOINT,
    isDevelopment: process.env.NODE_ENV !== 'production',
    reportOnly: process.env.CSP_REPORT_ONLY === 'true',
    turnstile: Boolean(process.env.TURNSTILE_SITE_KEY),
  });
  const forwarded = new Headers(request.headers);
  forwarded.set('x-nonce', nonce);
  forwarded.set('x-request-id', requestId);
  const csp = headers['Content-Security-Policy'] ?? headers['Content-Security-Policy-Report-Only'];
  if (csp) forwarded.set('content-security-policy', csp);
  const response = NextResponse.next({ request: { headers: forwarded } });
  for (const [k, v] of Object.entries(headers)) response.headers.set(k, v);
  return response;
}

export const config = {
  matcher: [
    {
      source: '/((?!_next/static|_next/image|favicon.ico|api/health).*)',
      missing: [{ type: 'header', key: 'next-router-prefetch' }],
    },
  ],
};
