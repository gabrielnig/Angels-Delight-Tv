import { SessionError, type PlaybackSession, type SessionProvider } from '@ad/player';

type FetchFn = (input: string, init?: RequestInit) => Promise<Response>;

function epochMs(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value))
    return value < 1e12 ? value * 1000 : value;
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? null : parsed;
  }
  return null;
}

/**
 * Staff preview sessions: `POST /api/play/{id}/session` with `{preview: true}` gives a one hour token that
 * needs no viewer profile (lane D, PlaybackService.startPreview). Used by caption review.
 */
export function createPreviewSessionProvider(options: {
  appOrigin: string;
  fetchFn?: FetchFn;
}): SessionProvider {
  const origin = options.appOrigin.replace(/\/+$/, '');
  const doFetch: FetchFn = options.fetchFn ?? ((input, init) => fetch(input, init));
  return {
    async createSession(videoId, signal) {
      let response: Response;
      try {
        response = await doFetch(`${origin}/api/play/${encodeURIComponent(videoId)}/session`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ preview: true }),
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
      const expiresAt = epochMs(body.expiresAt);
      if (
        typeof body.token !== 'string' ||
        typeof body.masterUrl !== 'string' ||
        expiresAt === null
      )
        throw new SessionError('network');
      const session: PlaybackSession = {
        token: body.token,
        expiresAt,
        masterUrl: new URL(body.masterUrl, `${origin}/`).toString(),
      };
      return session;
    },
  };
}
