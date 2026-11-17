import { createPgEventStore } from '@ad/analytics';
import { RateLimiter } from '@ad/security';
import { createAnalyticsHandler } from '../../../lib/analytics/handler';
import { resolveViewer } from '../../../lib/data/analytics-viewer';
import { withRequest } from '../../../lib/observability/with-request';
import { getServices } from '../../../lib/runtime/services';
import { installRealViewerResolver } from '../../../server/viewer/install-analytics';

export const dynamic = 'force-dynamic';

export async function POST(request: Request): Promise<Response> {
  installRealViewerResolver();
  const services = getServices();
  const handle = createAnalyticsHandler({
    store: createPgEventStore(services.db),
    limiter: new RateLimiter(services.db),
    secret: services.analyticsSecret,
    trustedProxyMode: services.env.TRUSTED_PROXY_MODE,
    resolveViewer,
  });
  return withRequest(async (req) => handle(req), {
    route: '/api/analytics',
    logger: services.logger,
    reporter: services.reporter,
  })(request);
}
