import { NextResponse, type NextRequest } from 'next/server';
import { googleFlow } from '../../../../../server/auth/google-runtime';
import { GOOGLE_FAILED_PATH } from '../../../../../server/auth/google-flow';

export const dynamic = 'force-dynamic';

const notFound = () => new NextResponse(null, { status: 404 });

/**
 * Starts Continue with Google (M49-S05). With no keys, or with the site setting off, this is a plain 404 and no
 * Google code path is reachable. The state, nonce and PKCE verifier live in a signed cookie, not in the URL.
 */
export async function GET(request: NextRequest) {
  const flow = googleFlow();
  if (!flow) return notFound();
  const result = await flow.start({
    next: request.nextUrl.searchParams.get('next') ?? undefined,
    link: request.nextUrl.searchParams.get('link') === '1',
  });
  switch (result.kind) {
    case 'not_found':
      return notFound();
    case 'redirect':
      return NextResponse.redirect(result.url, 302);
    case 'sign_in':
      return NextResponse.redirect(new URL('/sign-in', request.nextUrl.origin), 302);
    case 'failed':
      return NextResponse.redirect(new URL(GOOGLE_FAILED_PATH, request.nextUrl.origin), 302);
  }
}
