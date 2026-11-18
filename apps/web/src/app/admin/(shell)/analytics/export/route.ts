import { RateLimited } from '@ad/shared';
import { parseRange } from '@/lib/data/admin/analytics-rules';
import { titleDailyCsv } from '@/lib/data/admin/analytics-export';
import { INLINE_EXPORT_MAX, toQueryString } from '@/lib/data/admin/exports-rules';
import { analyticsService } from '@/lib/data/admin/services';
import { allowed, getActor, spendAdminBudget } from '@/lib/data/admin/session-next';

export const dynamic = 'force-dynamic';

/** Daily views and watch time per title for the chosen range (M19-S05). */
export async function GET(request: Request) {
  const actor = await getActor();
  if (!actor) return new Response('Sign in first.', { status: 401 });
  if (!allowed(actor, 'analytics.view'))
    return new Response('You do not have access to analytics.', { status: 403 });
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
  const url = new URL(request.url);
  const { range } = parseRange({
    range: 'custom',
    from: url.searchParams.get('from') ?? '',
    to: url.searchParams.get('to') ?? '',
  });
  // Up to 10,000 rows go straight back. More is built by the worker and emailed (M19-S05).
  const plan = await analyticsService.exportPlan(actor, range);
  if (plan.rows > INLINE_EXPORT_MAX) {
    const query = toQueryString({ kind: 'analytics', params: { from: range.from, to: range.to } });
    return new Response(null, {
      status: 303,
      headers: { location: `/admin/exports/new?${query}` },
    });
  }
  const rows = await analyticsService.exportRows(actor, range);
  return new Response(titleDailyCsv(rows), {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="analytics-${range.from}-to-${range.to}.csv"`,
      'cache-control': 'no-store',
    },
  });
}
