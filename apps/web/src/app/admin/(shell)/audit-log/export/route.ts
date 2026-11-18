import { RateLimited } from '@ad/shared';
import { getActor, allowed, spendAdminBudget } from '@/lib/data/admin/session-next';
import { parseAuditQuery, toCsv } from '@/lib/data/admin/audit-adapter';
import { INLINE_EXPORT_MAX, toQueryString } from '@/lib/data/admin/exports-rules';
import { auditService } from '@/lib/data/admin/services';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const actor = await getActor();
  if (!actor) return new Response('Sign in first.', { status: 401 });
  if (!allowed(actor, 'audit.export'))
    return new Response('Only a Super admin can export the audit log.', { status: 403 });
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
  const filters = { ...query, cursor: undefined, entry: undefined };
  // Up to 10,000 rows go straight back. More is built by the worker and emailed (M20-S03).
  const plan = await auditService.exportPlan(actor, filters);
  if (plan.rows > INLINE_EXPORT_MAX) {
    const params = toQueryString({
      kind: 'audit',
      params: Object.fromEntries(
        (['action', 'actor', 'target', 'outcome', 'from', 'to'] as const).flatMap((key) =>
          query[key] ? [[key, query[key] as string]] : [],
        ),
      ),
    });
    return new Response(null, {
      status: 303,
      headers: { location: `/admin/exports/new?${params}` },
    });
  }
  const { rows, truncated } = await auditService.exportRows(actor, filters);
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
