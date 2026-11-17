export const dynamic = 'force-dynamic';

/** Liveness only: the process is up. Database readiness is a separate /api/ready route. */
export async function GET(): Promise<Response> {
  return Response.json({ status: 'ok' }, { headers: { 'Cache-Control': 'no-store' } });
}
