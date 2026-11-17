import 'server-only';
import { withRequest } from '../../lib/observability/with-request';
import { getServices } from '../../lib/runtime/services';
import { videoApi } from './runtime';
import type { VideoApi } from './api';

type Params = Record<string, string | string[]>;
type RouteContext = { params: Promise<Params> };

/** Binds a video handler to a Next route: request id, structured log and a clean 500 for unexpected errors. */
export function videoRoute(
  route: string,
  pick: (api: VideoApi, request: Request, params: Params) => Promise<Response>,
) {
  return async (request: Request, context?: RouteContext): Promise<Response> => {
    const services = getServices();
    const params = context ? await context.params : {};
    return withRequest((req) => pick(videoApi(), req, params), {
      route,
      logger: services.logger,
      reporter: services.reporter,
    })(request);
  };
}

export const one = (params: Params, name: string): string => {
  const value = params[name];
  return Array.isArray(value) ? value.join('/') : (value ?? '');
};
