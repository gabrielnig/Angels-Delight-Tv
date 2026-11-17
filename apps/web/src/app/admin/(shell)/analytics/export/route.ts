import { csvCell } from '@ad/audit';
import { parseRange } from '@/lib/data/admin/analytics-rules';
import { analyticsService } from '@/lib/data/admin/services';
import { allowed, getActor } from '@/lib/data/admin/session-next';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const actor = await getActor();
  if (!actor) return new Response('Sign in first.', { status: 401 });
  if (!allowed(actor, 'analytics.view'))
    return new Response('You do not have access to analytics.', { status: 403 });
  const url = new URL(request.url);
  const { range } = parseRange({
    range: 'custom',
    from: url.searchParams.get('from') ?? '',
    to: url.searchParams.get('to') ?? '',
  });
  const data = await analyticsService.overview(actor, range);
  const line = (cells: unknown[]) => cells.map(csvCell).join(',');
  const body = [
    line(['day', 'views', 'watch_minutes']),
    ...data.daily.map((d) => line([d.day, d.views, Math.round(d.watchMs / 60_000)])),
    '',
    line(['title', 'views', 'watch_minutes', 'finished_percent']),
    ...data.top.map((t) =>
      line([t.title, t.views, Math.round(t.watchMs / 60_000), Math.round(t.completionRate * 100)]),
    ),
  ].join('\n');
  return new Response(`${body}\n`, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="analytics-${range.from}-to-${range.to}.csv"`,
      'cache-control': 'no-store',
    },
  });
}
