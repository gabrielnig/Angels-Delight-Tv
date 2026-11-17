import { errorResponse, jsonResponse } from '../http/respond';
import type { PlaybackService } from './service';

export interface PlaybackHttpDeps {
  service: Pick<PlaybackService, 'startSession' | 'startPreview' | 'master' | 'variant' | 'key'>;
  /** The signed in viewer and active profile, or throws Unauthorized. Owned by the auth lane. */
  getViewer(
    request: Request,
  ): Promise<{ accountId: string; profileId: string; kidsLocked?: boolean }>;
  /** The signed in admin or editor, or throws Unauthorized. */
  getActor(request: Request): Promise<{ accountId: string; role: 'admin' | 'editor' | 'viewer' }>;
  assertSameOrigin?(request: Request): void;
  /** Client address after trusted proxy handling. */
  clientIp(request: Request): string;
  onUnexpected?(error: unknown, request: Request): void;
}

const SECURE_HEADERS = {
  'cache-control': 'private, no-store',
  'referrer-policy': 'no-referrer',
  'x-content-type-options': 'nosniff',
};

/** Bearer header first, then the `pt` query parameter used by native HLS players that cannot set headers. */
function tokenOf(request: Request): { token: string | null; viaQuery: boolean } {
  const header = request.headers.get('authorization');
  const match = header ? /^Bearer (\S+)$/.exec(header) : null;
  if (match) return { token: match[1] as string, viaQuery: false };
  const pt = new URL(request.url).searchParams.get('pt');
  return { token: pt, viaQuery: pt !== null };
}

/** Thin handlers for ARCHITECTURE section 11. A Next route file is a one line wrapper around each. */
export function createPlaybackHandlers(deps: PlaybackHttpDeps) {
  async function run(request: Request, fn: () => Promise<Response>): Promise<Response> {
    try {
      return await fn();
    } catch (error) {
      const response = errorResponse(error, (e) => deps.onUnexpected?.(e, request));
      response.headers.set('referrer-policy', 'no-referrer');
      return response;
    }
  }

  const playlist = (body: string) =>
    new Response(body, {
      headers: { 'content-type': 'application/vnd.apple.mpegurl', ...SECURE_HEADERS },
    });

  return {
    /** POST /api/play/{id}/session. Body `{ preview: true }` asks for a staff preview. */
    session: (request: Request, videoId: string) =>
      run(request, async () => {
        deps.assertSameOrigin?.(request);
        const body = (await request.json().catch(() => ({}))) as {
          preview?: unknown;
          profileId?: unknown;
        };
        if (body.preview === true) {
          const actor = await deps.getActor(request);
          return jsonResponse(await deps.service.startPreview(actor, videoId));
        }
        const viewer = await deps.getViewer(request);
        // The player names the active profile. Ownership is checked in the service against the account.
        const profileId = typeof body.profileId === 'string' ? body.profileId : viewer.profileId;
        return jsonResponse(
          await deps.service.startSession(
            {
              accountId: viewer.accountId,
              profileId,
              ...(viewer.profileId ? { activeProfileId: viewer.profileId } : {}),
              ...(viewer.kidsLocked ? { kidsLocked: true } : {}),
            },
            videoId,
          ),
        );
      }),

    /** GET /api/play/{id}/master.m3u8 */
    master: (request: Request, videoId: string) =>
      run(request, async () => {
        const { token, viaQuery } = tokenOf(request);
        return playlist(await deps.service.master(token, videoId, viaQuery));
      }),

    /** GET /api/play/{id}/{height}.m3u8 */
    variant: (request: Request, videoId: string, height: string) =>
      run(request, async () => {
        const { token, viaQuery } = tokenOf(request);
        return playlist(await deps.service.variant(token, videoId, height, viaQuery));
      }),

    /** GET /api/hls/keys/{id}. Sixteen raw bytes. */
    key: (request: Request, videoId: string) =>
      run(request, async () => {
        const { token } = tokenOf(request);
        const key = await deps.service.key(token, videoId, deps.clientIp(request));
        return new Response(Buffer.from(key), {
          headers: { 'content-type': 'application/octet-stream', ...SECURE_HEADERS },
        });
      }),
  };
}
