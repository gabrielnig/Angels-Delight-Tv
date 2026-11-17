import 'server-only';
import { withRequest } from '../../lib/observability/with-request';
import { getServices } from '../../lib/runtime/services';
import { viewerApi } from './runtime';
import type { ViewerApi } from './api';

type Params = Record<string, string>;
type RouteContext = { params: Promise<Params> };

/** Binds a viewer handler to a Next route: request id, structured log and a clean 500 for unexpected errors. */
export function viewerRoute(
  route: string,
  pick: (api: ViewerApi) => (request: Request, params: Params) => Promise<Response>,
) {
  return async (request: Request, context?: RouteContext): Promise<Response> => {
    const services = getServices();
    const params = context ? await context.params : {};
    return withRequest((req) => pick(viewerApi())(req, params), {
      route,
      logger: services.logger,
      reporter: services.reporter,
    })(request);
  };
}
