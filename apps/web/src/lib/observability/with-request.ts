import type { Logger } from '@ad/shared';
import type { ErrorReporter } from './error-reporter';
import { requestIdFrom, REQUEST_ID_HEADER } from './request-id';

export interface RequestContext {
  requestId: string;
  logger: Logger;
}

export interface WithRequestOptions {
  /** Route template for logs and error reports, for example `/api/analytics`. Never the concrete URL. */
  route: string;
  logger: Logger;
  reporter?: ErrorReporter;
}

type Handler = (request: Request, context: RequestContext) => Promise<Response>;

const safe = (fn: () => void) => {
  try {
    fn();
  } catch {
    // Logging failure never breaks a request (M24-S01).
  }
};

/**
 * Wraps a route handler: request id in, request id out, one structured log line, and a clean 500 with the
 * reference id when the handler throws. The message of an unexpected error is never sent to the client.
 */
export function withRequest(handler: Handler, options: WithRequestOptions) {
  return async (request: Request): Promise<Response> => {
    const requestId = requestIdFrom(request.headers);
    const started = Date.now();
    let logger = options.logger;
    safe(() => {
      logger = options.logger.child({ requestId });
    });
    let response: Response;
    try {
      response = await handler(request, { requestId, logger });
    } catch (error) {
      safe(() =>
        logger.error('request failed', { route: options.route, method: request.method, error }),
      );
      safe(() => options.reporter?.capture(error, { route: options.route, requestId }));
      response = Response.json(
        {
          error: {
            code: 'internal_error',
            message: 'Something went wrong. Quote this reference if you contact us.',
            requestId,
          },
        },
        { status: 500 },
      );
    }
    const out = new Response(response.body, response);
    out.headers.set(REQUEST_ID_HEADER, requestId);
    safe(() =>
      logger.info('request', {
        route: options.route,
        method: request.method,
        status: out.status,
        ms: Date.now() - started,
      }),
    );
    return out;
  };
}
