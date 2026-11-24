import { withRequest } from '../../../lib/observability/with-request';
import { getServices } from '../../../lib/runtime/services';
import { sponsorClickHandler } from '../../../server/sponsors/click-route';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  context: { params: Promise<{ creativeId: string }> },
): Promise<Response> {
  const { creativeId } = await context.params;
  const services = getServices();
  return withRequest(async (req) => sponsorClickHandler()(req, creativeId), {
    route: '/s/[creativeId]',
    logger: services.logger,
    reporter: services.reporter,
  })(request);
}
