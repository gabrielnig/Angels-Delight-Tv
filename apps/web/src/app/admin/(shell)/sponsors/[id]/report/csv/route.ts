import { AppError, RateLimited } from '@ad/shared';
import { parseReportRange } from '@ad/sponsors';
import { allowed, getActor, spendAdminBudget } from '@/lib/data/admin/session-next';
import { sponsorReports } from '@/server/sponsors/admin';

export const dynamic = 'force-dynamic';

/** The sponsor report as CSV (M48-S11). Admins only, audited, sent straight back. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const actor = await getActor();
  if (!actor) return new Response('Sign in first.', { status: 401 });
  if (!allowed(actor, 'sponsor.report.export')) {
    return new Response('Only an admin can export sponsor reports.', { status: 403 });
  }
  try {
    await spendAdminBudget(actor);
  } catch (error) {
    if (error instanceof RateLimited) {
      return new Response('Too many requests.', {
        status: 429,
        headers: { 'retry-after': String(error.retryAfterSeconds) },
      });
    }
    throw error;
  }
  const { id } = await params;
  const url = new URL(request.url);
  const { fromDay, toDay } = parseReportRange(
    { from: url.searchParams.get('from') ?? undefined, to: url.searchParams.get('to') ?? undefined },
    new Date(),
  );
  try {
    const out = await sponsorReports(actor).exportCsv(actor, id, fromDay, toDay);
    return new Response(out.csv, {
      headers: {
        'content-type': 'text/csv; charset=utf-8',
        'content-disposition': `attachment; filename="${out.fileName}"`,
        'cache-control': 'no-store',
      },
    });
  } catch (error) {
    if (error instanceof AppError) return new Response(error.message, { status: error.status });
    throw error;
  }
}
