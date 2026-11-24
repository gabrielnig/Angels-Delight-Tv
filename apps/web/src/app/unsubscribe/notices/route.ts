import { sql } from 'drizzle-orm';
import { getServices } from '../../../lib/runtime/services';
import { handleUnsubscribe } from '../../../server/viewer/unsubscribe';

export const dynamic = 'force-dynamic';

function deps() {
  const services = getServices();
  return {
    kek: services.env.FIELD_KEK,
    now: () => new Date(),
    async unsubscribe(accountId: string) {
      const result = await services.db.execute<{ done: boolean }>(
        sql`SELECT viewer_notices_unsubscribe(${accountId}::uuid) AS done`,
      );
      return result.rows[0]?.done === true;
    },
  };
}

export const GET = (request: Request) => handleUnsubscribe(request, deps());
export const POST = (request: Request) => handleUnsubscribe(request, deps());
