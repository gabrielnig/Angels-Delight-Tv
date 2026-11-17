import {
  databaseCheck,
  queueCheck,
  runReadiness,
  storageCheck,
} from '../../../lib/observability/ready';
import { getServices } from '../../../lib/runtime/services';

export const dynamic = 'force-dynamic';

/**
 * Readiness for the uptime monitor and the load balancer (M24-S02): database, storage and queue. 200 when all pass,
 * 503 otherwise. The body names the checks and whether each passed, never why. Liveness stays at /api/health.
 */
export async function GET(): Promise<Response> {
  let result;
  try {
    const { db, mediaStorage } = getServices();
    result = await runReadiness({
      database: databaseCheck(db),
      storage: storageCheck(mediaStorage),
      queue: queueCheck(db),
    });
  } catch {
    // Missing or invalid configuration: not ready, and nothing more is said.
    result = { ok: false, checks: {} };
  }
  return Response.json(result, {
    status: result.ok ? 200 : 503,
    headers: { 'Cache-Control': 'no-store' },
  });
}
