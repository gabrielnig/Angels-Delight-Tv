import type { Database } from '@ad/db';
import { publish, type PublishingContext } from '@ad/catalog';
import { ValidationFailed, type Actor } from '@ad/shared';
import { assertSameOrigin, clientIp, type TrustedProxyMode } from '@ad/security';
import {
  CaptionNeedsConfirmation,
  createPlaybackHandlers,
  createUploadHandlers,
  errorResponse,
  jsonResponse,
  readJson,
  type CaptionService,
  type PlaybackService,
  type UploadService,
} from '@ad/video';
import { encodingStatus } from './encoding';

export interface VideoRuntime {
  db: Database;
  auth: {
    getActor(request: Request): Promise<Actor>;
    getViewer(request: Request): Promise<{ accountId: string; profileId: string }>;
  };
  upload: UploadService;
  playback: PlaybackService;
  captions: CaptionService;
  publishing: PublishingContext;
  appOrigin: string;
  trustedProxyMode: TrustedProxyMode;
  /** Present in development only. Production leaves them out and the routes answer 404. */
  devStorage?: (request: Request) => Promise<Response>;
  devMedia?: (request: Request, key: string) => Promise<Response>;
  onUnexpected?(error: unknown, request: Request): void;
}

const PLAYLIST_FILE = /^(master|\d{3,4})\.m3u8$/;

const notFound = () => jsonResponse({ error: { code: 'not_found', message: 'Not found' } }, 404);

/**
 * Every web route of the video pipeline, as functions of a Request. The Next route files are one line wrappers
 * (see `route.ts`), so the rules here are tested without a server.
 */
export function createVideoApi(rt: VideoRuntime) {
  const sameOrigin = (request: Request) => assertSameOrigin(request.headers, rt.appOrigin);

  const upload = createUploadHandlers({
    service: rt.upload,
    getActor: rt.auth.getActor,
    assertSameOrigin: sameOrigin,
    onUnexpected: rt.onUnexpected,
  });

  const playback = createPlaybackHandlers({
    service: rt.playback,
    getViewer: rt.auth.getViewer,
    getActor: rt.auth.getActor,
    assertSameOrigin: sameOrigin,
    // Without a trusted proxy there is no reliable address. Everyone then shares one per IP bucket, which only
    // happens in development. Production sets TRUSTED_PROXY_MODE=cloudflare.
    clientIp: (request) => clientIp(request.headers, rt.trustedProxyMode) ?? 'untrusted',
    onUnexpected: rt.onUnexpected,
  });

  async function staff(
    request: Request,
    write: boolean,
    fn: (actor: Actor) => Promise<Response>,
  ): Promise<Response> {
    try {
      if (write) sameOrigin(request);
      return await fn(await rt.auth.getActor(request));
    } catch (error) {
      if (error instanceof CaptionNeedsConfirmation) {
        return jsonResponse(
          { error: { code: error.code, message: error.message, warnings: error.warnings } },
          error.status,
        );
      }
      return errorResponse(error, (e) => rt.onUnexpected?.(e, request));
    }
  }

  return {
    upload,

    play: {
      session: playback.session,
      /** Serves `master.m3u8` and `{height}.m3u8`. Any other file name is a plain 404. */
      playlist(request: Request, videoId: string, file: string): Promise<Response> {
        const match = PLAYLIST_FILE.exec(file);
        if (!match) return Promise.resolve(notFound());
        return match[1] === 'master'
          ? playback.master(request, videoId)
          : playback.variant(request, videoId, match[1] as string);
      },
      key: playback.key,
    },

    admin: {
      encoding: (request: Request, videoId: string) =>
        staff(request, false, async (actor) =>
          jsonResponse(await encodingStatus(rt.db, actor, videoId)),
        ),

      captions: {
        list: (request: Request, videoId: string) =>
          staff(request, false, async (actor) =>
            jsonResponse({ tracks: await rt.captions.listForVideo(actor, videoId) }),
          ),
        approve: (request: Request, captionId: string) =>
          staff(request, true, async (actor) => {
            const body = (await readJson(request)) as { confirmWarnings?: unknown };
            const row = await rt.captions.approve(actor, captionId, {
              confirmWarnings: body.confirmWarnings === true,
            });
            return jsonResponse({ caption: { id: row.id, status: row.status } });
          }),
      },

      publish: (request: Request, videoId: string) =>
        staff(request, true, async (actor) => {
          const body = (await readJson(request)) as {
            publishAt?: unknown;
            captionOverride?: { reason?: unknown };
          };
          let publishAt: Date | undefined;
          if (body.publishAt !== undefined) {
            publishAt = new Date(String(body.publishAt));
            if (Number.isNaN(publishAt.getTime()))
              throw new ValidationFailed({ publishAt: ['Send a valid date and time.'] });
          }
          const reason = body.captionOverride?.reason;
          const result = await publish(rt.publishing, actor, 'video', videoId, {
            ...(publishAt ? { publishAt } : {}),
            ...(typeof reason === 'string' ? { captionOverride: { reason } } : {}),
          });
          return jsonResponse(result);
        }),
    },

    devStorage: (request: Request) =>
      rt.devStorage ? rt.devStorage(request) : Promise.resolve(notFound()),
    devMedia: (request: Request, key: string) =>
      rt.devMedia ? rt.devMedia(request, key) : Promise.resolve(notFound()),
  };
}

export type VideoApi = ReturnType<typeof createVideoApi>;
