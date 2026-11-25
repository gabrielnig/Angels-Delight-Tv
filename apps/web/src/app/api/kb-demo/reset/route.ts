import { kbDemoAllowed, resetDemoStore } from '@/lib/data/admin/kb-demo/reset';

export const dynamic = 'force-dynamic';

const LOCAL = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/;

/**
 * Resets the in memory demo data between knowledge base recordings (lane L14). Exists only on a development fixture
 * build started with KB_DEMO=on, answers only to a local host and needs a marker header, so a stray request does nothing.
 */
export async function POST(request: Request): Promise<Response> {
  if (!kbDemoAllowed()) return new Response('Not found', { status: 404 });
  if (request.headers.get('x-kb-demo') !== 'reset')
    return new Response('Forbidden', { status: 403 });
  const host = request.headers.get('host') ?? '';
  if (!LOCAL.test(host)) return new Response('Forbidden', { status: 403 });
  const { now } = resetDemoStore();
  return Response.json({ now }, { headers: { 'Cache-Control': 'no-store' } });
}
