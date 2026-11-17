import { ProgressSinkError, type ProgressSink, type ProgressUpdate } from './progress';
import { SessionError, type PlaybackSession, type SessionProvider } from './token';

type FetchFn = (input: string, init?: RequestInit) => Promise<Response>;

export interface HttpSessionOptions {
  appOrigin: string;
  profileId: string;
  fetchFn?: FetchFn;
}

function toEpochMs(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value))
    return value < 1e12 ? value * 1000 : value;
  if (typeof value === 'string') {
    const t = Date.parse(value);
    return Number.isNaN(t) ? null : t;
  }
  return null;
}

/**
 * POST /api/play/{videoId}/session (docs/ARCHITECTURE.md section 11).
 * Response: { token, expiresAt (ISO string or epoch), masterUrl (absolute or app relative) }.
 * 401 means sign in again, 403, 404 and 410 mean the video is not available to this profile,
 * 429 is rate limiting, anything else is treated as a network problem.
 */
export function createHttpSessionProvider(opts: HttpSessionOptions): SessionProvider {
  const origin = opts.appOrigin.replace(/\/+$/, '');
  const doFetch: FetchFn = opts.fetchFn ?? ((input, init) => fetch(input, init));
  return {
    async createSession(videoId, signal) {
      let response: Response;
      try {
        response = await doFetch(`${origin}/api/play/${encodeURIComponent(videoId)}/session`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ profileId: opts.profileId }),
          ...(signal ? { signal } : {}),
        });
      } catch {
        throw new SessionError('network');
      }
      if (response.status === 401) throw new SessionError('auth');
      if ([403, 404, 410].includes(response.status)) throw new SessionError('gone');
      if (response.status === 429) throw new SessionError('rate-limited');
      if (!response.ok) throw new SessionError('network');
      let body: { token?: unknown; expiresAt?: unknown; masterUrl?: unknown };
      try {
        body = (await response.json()) as typeof body;
      } catch {
        throw new SessionError('network');
      }
      const expiresAt = toEpochMs(body.expiresAt);
      if (
        typeof body.token !== 'string' ||
        typeof body.masterUrl !== 'string' ||
        expiresAt === null
      ) {
        throw new SessionError('network');
      }
      const session: PlaybackSession = {
        token: body.token,
        expiresAt,
        masterUrl: new URL(body.masterUrl, `${origin}/`).toString(),
      };
      return session;
    },
  };
}

export interface HttpProgressOptions {
  /** Idempotent write route. Receives the JSON of a ProgressUpdate by POST. */
  endpoint: string;
  fetchFn?: FetchFn;
  sendBeacon?: (url: string, data: Blob) => boolean;
}

/** Progress writes by keepalive fetch, or sendBeacon when the page is going away. */
export function createHttpProgressSink(opts: HttpProgressOptions): ProgressSink {
  const doFetch: FetchFn = opts.fetchFn ?? ((input, init) => fetch(input, init));
  const beacon =
    opts.sendBeacon ??
    (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function'
      ? (url: string, data: Blob) => navigator.sendBeacon(url, data)
      : undefined);

  return {
    async save(update: ProgressUpdate, options) {
      const body = JSON.stringify(update);
      if (
        options?.beacon &&
        beacon &&
        beacon(opts.endpoint, new Blob([body], { type: 'application/json' }))
      )
        return;
      let response: Response;
      try {
        response = await doFetch(opts.endpoint, {
          method: 'POST',
          credentials: 'include',
          keepalive: true,
          headers: { 'content-type': 'application/json' },
          body,
        });
      } catch {
        throw new ProgressSinkError(0, 'network error');
      }
      if (!response.ok) throw new ProgressSinkError(response.status);
    },
  };
}
