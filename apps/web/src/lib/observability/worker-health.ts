import { judgeHeartbeat } from '@ad/queue';

/**
 * The body behind `/api/health/worker`, polled by the uptime monitor (M24-S02 AC2). 503 when the worker has not
 * reported for 5 minutes. A read failure counts as down and says nothing about why.
 */
export async function workerHealthResponse(
  readLast: () => Promise<Date | null>,
  now: Date = new Date(),
): Promise<Response> {
  let body: { ok: boolean; ageSeconds: number | null };
  try {
    body = judgeHeartbeat(await readLast(), now);
  } catch {
    body = { ok: false, ageSeconds: null };
  }
  return Response.json(body, {
    status: body.ok ? 200 : 503,
    headers: { 'Cache-Control': 'no-store' },
  });
}
