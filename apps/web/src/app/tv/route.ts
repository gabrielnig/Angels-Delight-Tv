import { NextResponse, type NextRequest } from 'next/server';
import { TV_COOKIE, TV_COOKIE_MAX_AGE } from '../../lib/tv/detect';

export const dynamic = 'force-dynamic';

/**
 * Short to type with a remote. Turns TV mode on for this device and goes Home (M49-S15). The cookie holds a display
 * preference only, so it is readable by the page script and carries no secret.
 */
export function GET(request: NextRequest) {
  const response = NextResponse.redirect(new URL('/', request.nextUrl.origin), 302);
  response.cookies.set(TV_COOKIE, 'on', {
    path: '/',
    maxAge: TV_COOKIE_MAX_AGE,
    sameSite: 'lax',
    secure: request.nextUrl.protocol === 'https:',
  });
  response.headers.set('cache-control', 'no-store');
  return response;
}
