import { NextResponse, type NextRequest } from 'next/server';
import { googleFlow } from '../../../../../server/auth/google-runtime';

export const dynamic = 'force-dynamic';

/**
 * Where Google sends the browser back. Every failure ends on one generic page. The code is exchanged on the
 * server, so no Google origin is needed in the CSP.
 */
export async function GET(request: NextRequest) {
  const flow = googleFlow();
  if (!flow || !(await flow.available())) return new NextResponse(null, { status: 404 });
  const params = request.nextUrl.searchParams;
  const { redirect } = await flow.callback({
    code: params.get('code'),
    state: params.get('state'),
    error: params.get('error'),
  });
  const response = NextResponse.redirect(new URL(redirect, request.nextUrl.origin), 302);
  response.headers.set('cache-control', 'no-store');
  return response;
}
