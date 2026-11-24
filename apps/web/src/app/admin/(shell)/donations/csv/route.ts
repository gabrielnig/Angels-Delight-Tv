import { AppError, RateLimited } from '@ad/shared';
import { allowed, getActor, spendAdminBudget } from '@/lib/data/admin/session-next';
import { donationAdmin } from '@/server/donations/admin';

export const dynamic = 'force-dynamic';

/** The donations list as CSV (M48-S36). Admins only, audited, masked emails, sent straight back. */
export async function GET(request: Request) {
  const actor = await getActor();
  if (!actor) return new Response('Sign in first.', { status: 401 });
  if (!allowed(actor, 'donation.export')) return new Response('Only an admin can export donations.', { status: 403 });
  try {
    await spendAdminBudget(actor);
  } catch (error) {
    if (error instanceof RateLimited) {
      return new Response('Too many requests.', { status: 429, headers: { 'retry-after': String(error.retryAfterSeconds) } });
    }
    throw error;
  }
  const q = new URL(request.url).searchParams;
  try {
    const out = await donationAdmin(actor).exportCsv(actor, {
      status: (q.get('status') ?? undefined) as never,
      kind: (q.get('kind') ?? undefined) as never,
      from: q.get('from') ?? undefined,
      to: q.get('to') ?? undefined,
    });
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
