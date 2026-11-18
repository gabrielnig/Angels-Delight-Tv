import { Readable } from 'node:stream';
import { Conflict, Forbidden, NotFound, RateLimited } from '@ad/shared';
import { exportsAdmin } from '@/lib/data/admin/exports';
import { getActor, spendAdminBudget } from '@/lib/data/admin/session-next';

export const dynamic = 'force-dynamic';

/** Downloads one finished export (M19-S05, M20-S03). Only the person who asked can open it, until it expires. */
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const actor = await getActor();
  if (!actor) return new Response('Sign in first.', { status: 401 });
  try {
    await spendAdminBudget(actor);
    const { id } = await context.params;
    const file = await exportsAdmin.open(actor, id);
    return new Response(Readable.toWeb(file.stream) as ReadableStream, {
      headers: {
        'content-type': 'text/csv; charset=utf-8',
        'content-disposition': `attachment; filename="${file.fileName}"`,
        'content-length': String(file.bytes),
        'cache-control': 'private, no-store',
        'x-content-type-options': 'nosniff',
      },
    });
  } catch (error) {
    if (error instanceof RateLimited)
      return new Response('Too many requests.', {
        status: 429,
        headers: { 'retry-after': String(error.retryAfterSeconds) },
      });
    if (error instanceof Forbidden)
      return new Response('You do not have access to this.', { status: 403 });
    if (error instanceof Conflict) return new Response(error.message, { status: 409 });
    // A missing, expired and someone else's file all look the same from outside.
    if (error instanceof NotFound)
      return new Response('This file is not available.', { status: 404 });
    throw error;
  }
}
