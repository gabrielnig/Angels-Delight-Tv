import { createExportHandler } from '../../../../server/data/export-route';
import { realDataEnabled } from '../../../../server/data/mode';
import { accountViewerData } from '../../../../server/data/real-data';
import { authRuntime } from '../../../../server/auth/runtime';
import { getSession } from '../../../../server/auth/session';
import { withRequest } from '../../../../lib/observability/with-request';
import { getServices } from '../../../../lib/runtime/services';

export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<Response> {
  if (!realDataEnabled()) return new Response(null, { status: 404 });
  const services = getServices();
  const handler = createExportHandler({
    async sessionAccountId() {
      const session = await getSession();
      return session && session.status === 'active' && session.emailVerified
        ? session.accountId
        : null;
    },
    async accountInfo(accountId) {
      const info = await authRuntime().staff.getOverview({
        accountId,
        role: 'viewer',
        sessionId: '',
      });
      return { email: info.email, memberSince: info.memberSince.toISOString() };
    },
    data: accountViewerData(),
  });
  return withRequest((req) => handler(req), {
    route: '/api/account/export',
    logger: services.logger,
    reporter: services.reporter,
  })(request);
}
