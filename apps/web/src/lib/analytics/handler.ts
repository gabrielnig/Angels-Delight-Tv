import { ingestBatch, MAX_BODY_BYTES, type EventStore, type RateLimiter } from '@ad/analytics';
import { clientIp, truncateIp, type TrustedProxyMode } from '@ad/security';

export interface ViewerContext {
  profileId: string | null;
  audience: 'general' | 'kids';
}

export interface AnalyticsHandlerDeps {
  store: EventStore;
  limiter: RateLimiter;
  secret: Uint8Array;
  trustedProxyMode: TrustedProxyMode;
  /** From the session. The body is never trusted for identity. The integration pass wires the auth lane here. */
  resolveViewer(request: Request): Promise<ViewerContext>;
}

const noStore = { 'Cache-Control': 'no-store' };

/** POST /api/analytics. Always quick and quiet: 202 with no body for anything accepted or ignored. */
export function createAnalyticsHandler(deps: AnalyticsHandlerDeps) {
  return async (request: Request): Promise<Response> => {
    const declared = Number(request.headers.get('content-length') ?? 0);
    if (declared > MAX_BODY_BYTES) return new Response(null, { status: 413, headers: noStore });
    const text = await request.text();
    if (text.length > MAX_BODY_BYTES) return new Response(null, { status: 413, headers: noStore });

    let body: unknown;
    try {
      body = JSON.parse(text);
    } catch {
      return new Response(null, { status: 400, headers: noStore });
    }

    let viewer: ViewerContext = { profileId: null, audience: 'general' };
    try {
      viewer = await deps.resolveViewer(request);
    } catch {
      // Analytics must not depend on auth being healthy.
    }

    const ip = clientIp(request.headers, deps.trustedProxyMode);
    const result = await ingestBatch({
      body,
      context: {
        userAgent: request.headers.get('user-agent'),
        country: request.headers.get('cf-ipcountry'),
        ipKey: (ip ? truncateIp(ip) : null) ?? 'unknown',
        profileId: viewer.profileId,
        audience: viewer.audience,
      },
      store: deps.store,
      limiter: deps.limiter,
      secret: deps.secret,
    });

    const headers: Record<string, string> = { ...noStore };
    if (result.retryAfterSeconds) headers['Retry-After'] = String(result.retryAfterSeconds);
    return new Response(null, { status: result.status, headers });
  };
}
