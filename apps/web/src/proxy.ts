import { type NextRequest, NextResponse } from 'next/server';
import { requestIdFrom } from './lib/observability/request-id';
import { normalizeLocale, parseAcceptLanguage } from '@ad/shared/messages';
import { LOCALE_COOKIE, localeCookieOptions, readLocaleCookie } from './lib/i18n/cookie';
import { proxyResponseHeaders } from './server/auth/proxy-headers';

/** Nonce CSP, security headers and request ids (SECURITY.md sections 4 and 14). Reads process.env directly. */
export function proxy(request: NextRequest) {
  const nonce = btoa(crypto.randomUUID());
  const requestId = requestIdFrom(request.headers);
  const headers = proxyResponseHeaders({
    pathname: request.nextUrl.pathname,
    nonce,
    requestId,
    mediaOrigin: process.env.MEDIA_ORIGIN
      ? new URL(process.env.MEDIA_ORIGIN).origin
      : "'self'",
    s3Endpoint: process.env.S3_ENDPOINT,
    s3Bucket: process.env.BUCKET_ORIGINALS ?? 'ad-originals',
    isDevelopment: process.env.NODE_ENV !== 'production',
    reportOnly: process.env.CSP_REPORT_ONLY === 'true',
    turnstile: Boolean(process.env.TURNSTILE_SITE_KEY),
  });
  const forwarded = new Headers(request.headers);
  forwarded.set('x-nonce', nonce);
  forwarded.set('x-request-id', requestId);
  // Locale hint (M46): ?lang= wins and is stored in the cookie, else the cookie, else the best Accept-Language match.
  const queryLocale = normalizeLocale(request.nextUrl.searchParams.get('lang'));
  const cookieLocale = readLocaleCookie(request.cookies.get(LOCALE_COOKIE)?.value);
  const acceptLocale = parseAcceptLanguage(request.headers.get('accept-language'))[0];
  const hint = queryLocale
    ? { code: queryLocale, source: 'query' }
    : cookieLocale
      ? { code: cookieLocale, source: 'cookie' }
      : acceptLocale && acceptLocale !== 'en'
        ? { code: acceptLocale, source: 'accept' }
        : null;
  forwarded.delete('x-ad-locale-hint');
  forwarded.delete('x-ad-locale-source');
  if (hint) {
    forwarded.set('x-ad-locale-hint', hint.code);
    forwarded.set('x-ad-locale-source', hint.source);
  }
  const csp = headers['Content-Security-Policy'] ?? headers['Content-Security-Policy-Report-Only'];
  if (csp) forwarded.set('content-security-policy', csp);
  const response = NextResponse.next({ request: { headers: forwarded } });
  for (const [k, v] of Object.entries(headers)) response.headers.set(k, v);
  if (queryLocale) {
    response.cookies.set(
      LOCALE_COOKIE,
      queryLocale,
      localeCookieOptions(process.env.NODE_ENV === 'production'),
    );
  }
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
