import { RateLimited } from '@ad/shared';
import { getActor, allowed, spendAdminBudget } from '@/lib/data/admin/session-next';
import { parseAuditQuery, toCsv } from '@/lib/data/admin/audit-adapter';
import { auditService } from '@/lib/data/admin/services';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const actor = await getActor();
  if (!actor) return new Response('Sign in first.', { status: 401 });
  if (!allowed(actor, 'audit.read'))
    return new Response('Only admins can export the audit log.', { status: 403 });
  try {
    await spendAdminBudget(actor);
  } catch (error) {
    if (error instanceof RateLimited)
      return new Response('Too many requests.', {
        status: 429,
        headers: { 'retry-after': String(error.retryAfterSeconds) },
      });
    throw error;
  }
  const query = parseAuditQuery(Object.fromEntries(new URL(request.url).searchParams));
  const { rows, truncated } = await auditService.exportRows(actor, { ...query, cursor: undefined });
  const stamp = new Date().toISOString().slice(0, 10);
  return new Response(toCsv(rows), {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="audit-log-${stamp}.csv"`,
      'cache-control': 'no-store',
      ...(truncated ? { 'x-export-truncated': 'true' } : {}),
    },
  });
}
