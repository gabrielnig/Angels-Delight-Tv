import type { Logger } from '@ad/shared';
import type { ErrorReporter } from './error-reporter';
import { REQUEST_ID_HEADER, requestIdFrom } from './request-id';

export interface FailedRequest {
  path: string;
  method: string;
  headers: Record<string, string | string[] | undefined> | Headers;
}

export interface FailedRequestContext {
  routePath: string;
  routeType: string;
  routerKind: string;
}

/**
 * Reports an error from a page, layout or server action, which no route wrapper sees. Next calls this through
 * `onRequestError` in instrumentation.ts. The route is the template (`/watch/[id]`), never the concrete url, and
 * nothing from the query string is kept. Never throws.
 */
export function reportRequestError(
  error: unknown,
  request: FailedRequest,
  context: FailedRequestContext,
  deps: { reporter: ErrorReporter; logger: Logger },
): void {
  try {
    const headers = new Headers();
    const raw = request.headers;
    const inbound = raw instanceof Headers ? raw.get(REQUEST_ID_HEADER) : raw[REQUEST_ID_HEADER];
    if (typeof inbound === 'string') headers.set(REQUEST_ID_HEADER, inbound);
    const requestId = requestIdFrom(headers);
    const route = context.routePath || request.path.split('?')[0] || '/';
    try {
      deps.logger.error('request failed', {
        route,
        method: request.method,
        type: context.routeType,
        requestId,
        error,
      });
    } catch {
      // logging failure never breaks a request
    }
    deps.reporter.capture(error, { route, requestId });
  } catch {
    // reporting is best effort
  }
}
