import 'server-only';
import { loadWebEnv } from '@ad/config';
import { createDb, createPool } from '@ad/db';
import {
  DrizzleJobMirror,
  JobProducer,
  createProducerBoss,
  bossAdapter,
  type BossLike,
} from '@ad/queue';
import { createStorage, storageConfigFromEnv, type LocalStorage } from '@ad/storage';
import {
  CaptionService,
  DrizzlePlaybackStore,
  PlaybackService,
  UploadService,
  createDevMediaHandler,
  createDevStorageHandler,
  keyring,
  secretRing,
} from '@ad/video';
import { truncateIp } from '@ad/security';
import { createLogger } from '@ad/shared';
import { getActor, getViewer } from '../auth/request-actor';
import { authRuntime } from '../auth/runtime';
import { activeProfileKey } from '../viewer/runtime';
import { turnstileFromEnv, verifyTurnstile } from '../auth/turnstile';
import { createGuestChallenge, networkSubject } from '../guest/challenge';
import { guestAudienceFromRequest } from '../guest/guest-audience';
import { guestSetCookie } from '../guest/guest-cookie';
import { resolveGuest } from '../guest/resolve-guest';
import { themeRuntime } from '../../lib/data/admin/theme-runtime';
import { createVideoApi, type VideoApi } from './api';

/** Web side of the job queue: a producer-only pg-boss client, started on first send. */
function lazyBoss(connectionString: string, onError: (error: Error) => void): BossLike {
  let started: Promise<BossLike> | undefined;
  const boss = () =>
    (started ??= createProducerBoss({ connectionString, onError }).then((raw) => bossAdapter(raw)));
  return {
    createQueue: async (name, options) => (await boss()).createQueue(name, options),
    send: async (name, data, options) => (await boss()).send(name, data, options),
    work: async (name, options, handler) => (await boss()).work(name, options, handler),
    schedule: async (name, cron, data, options) =>
      (await boss()).schedule(name, cron, data, options),
  };
}

const slot = Symbol.for('ad.video.api');
type Holder = { [slot]?: VideoApi };

/** Built once on first use, so importing a route file never needs the environment. */
export function videoApi(): VideoApi {
  const holder = globalThis as Holder;
  return (holder[slot] ??= build());
}

function build(): VideoApi {
  const env = loadWebEnv();
  const auth = authRuntime();
  const logger = createLogger({ level: env.LOG_LEVEL, bindings: { component: 'video' } });
  const db = createDb(createPool(env.DATABASE_URL, { max: 6, applicationName: 'ad-web-video' }));

  // The local driver signs dev urls that /api/dev-storage and /api/dev-media verify, so both use the media secret.
  const secret = env.MEDIA_URL_SECRET;
  const originals = createStorage(storageConfigFromEnv(env, env.BUCKET_ORIGINALS, secret));
  const media = createStorage(storageConfigFromEnv(env, env.BUCKET_MEDIA, secret));

  const producer = new JobProducer({
    boss: lazyBoss(env.DATABASE_URL, (error) => logger.error('queue error', { err: error })),
    mirror: new DrizzleJobMirror(db),
  });

  const guestSecret = activeProfileKey(env.PLAYBACK_TOKEN_SECRET);
  const turnstileKeys = turnstileFromEnv(env);
  const local = env.STORAGE_DRIVER === 'local' && env.NODE_ENV !== 'production';

  return createVideoApi({
    db,
    auth: { getActor, getViewer },
    upload: new UploadService({
      db,
      originals,
      media,
      producer,
      limits: { maxBytes: env.MAX_UPLOAD_BYTES, partBytes: env.UPLOAD_PART_BYTES },
      logger,
    }),
    playback: new PlaybackService({
      store: new DrizzlePlaybackStore(db),
      originals,
      tokens: secretRing(env.PLAYBACK_TOKEN_SECRET, env.PLAYBACK_TOKEN_SECRET_PREVIOUS),
      mediaSecret: env.MEDIA_URL_SECRET,
      keyring: keyring(env.HLS_KEK, env.HLS_KEK_PREVIOUS),
      limiter: auth.limiter,
      guestSegmentTtlSeconds: async () =>
        (await (await themeRuntime()).settings.get('limits.guest_segment_minutes')) * 60,
      appOrigin: env.APP_ORIGIN,
      mediaOrigin: env.MEDIA_ORIGIN,
    }),
    guest: {
      subject: (ip) => networkSubject(guestSecret, ip, 'guest-session'),
      ...(turnstileKeys
        ? {
            challenge: createGuestChallenge({
              limiter: auth.limiter,
              secret: guestSecret,
              verify: (token, ip) => verifyTurnstile(turnstileKeys, token, ip),
            }),
          }
        : {}),
      playEnabled: async () => (await themeRuntime()).settings.get('features.guest_play'),
      getGuest: async (request, { mint }) => {
        const resolved = resolveGuest(request, {
          secret: guestSecret,
          secure: auth.secureCookies,
          mint,
        });
        if (!resolved) return null;
        return {
          guestId: resolved.guestId,
          // The device choice, else the site default (R18). A Kids mode guest gets a Kids safe token.
          kids:
            guestAudienceFromRequest(
              request,
              auth.secureCookies,
              await (await themeRuntime()).settings.get('features.guest_audience'),
            ) === 'kids',
          ...(resolved.isNew
            ? { setCookie: guestSetCookie(guestSecret, auth.secureCookies, resolved.guestId) }
            : {}),
        };
      },
    },
    captions: new CaptionService({ db, originals, media, producer, audit: auth.audit }),
    publishing: { db },
    appOrigin: env.APP_ORIGIN,
    trustedProxyMode: env.TRUSTED_PROXY_MODE,
    ...(local
      ? {
          devStorage: createDevStorageHandler({
            nodeEnv: env.NODE_ENV,
            secret,
            buckets: {
              [env.BUCKET_ORIGINALS]: originals as LocalStorage,
              [env.BUCKET_MEDIA]: media as LocalStorage,
            },
          }),
          devMedia: createDevMediaHandler({ nodeEnv: env.NODE_ENV, mediaSecret: secret, media }),
        }
      : {}),
    onDenied: (info) =>
      logger.warn('playback denied', {
        route: info.route,
        status: info.status,
        videoId: info.videoId,
        ip: truncateIp(info.ip),
      }),
    onUnexpected: (error, request) =>
      logger.error('video route failed', { err: error, path: new URL(request.url).pathname }),
  });
}
