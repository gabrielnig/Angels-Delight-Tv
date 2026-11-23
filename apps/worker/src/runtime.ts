import { makeNotifier } from './notifier';
import { runNightlyRollup } from '@ad/analytics';
import type { WorkerEnv } from '@ad/config';
import { Mailer, transportFromSmtpUrl, type MailTransport } from '@ad/mailer';
import { createDb, createPool, type Database } from '@ad/db';
import {
  DrizzleJobMirror,
  JobProducer,
  bossAdapter,
  buildDigests,
  drainOutbox,
  pruneOutbox,
  queueImmediateNotices,
} from '@ad/queue';
import type { Logger } from '@ad/shared';
import { createStorage, storageConfigFromEnv } from '@ad/storage';
import { readSetting } from '@ad/theme/settings';
import {
  CaptionGenerator,
  ImageService,
  LifecycleService,
  UploadService,
  VideoPipeline,
  keyring,
} from '@ad/video';
import type { PgBoss } from 'pg-boss';
import type { VideoHandlerDeps } from './handlers';
import { chooseTranscriber } from './transcriber';
import type { MaintenanceDeps } from './maintenance';
import type { MailDeps } from './mail';
import type { ExportDeps } from './export-handlers';
import { cleanupExports, generateExport } from './exports';
import { makePrunes } from './prunes';

// Cleanup never validates new uploads, so the limits here are placeholders.
const MIB = 1024 * 1024;

/** Builds the lane D services from the worker environment. Kept apart from boot so boot stays testable. */
export function createWorkerDb(env: WorkerEnv): Database {
  return createDb(createPool(env.DATABASE_URL_WORKER, { max: 4, applicationName: 'ad-worker' }));
}

/** The lane I jobs. The prunes run on their own `ad_maintenance` connection, which is the only role allowed to delete. */
export function buildMaintenanceDeps(
  env: WorkerEnv,
  db: Database,
  _logger: Logger,
): Omit<MaintenanceDeps, 'mirror' | 'logger'> {
  const maintenanceUrl = env.DATABASE_URL_MAINTENANCE;
  if (!maintenanceUrl) return { rollup: () => runNightlyRollup(db) };
  const maintenance = createDb(
    createPool(maintenanceUrl, { max: 1, applicationName: 'ad-worker-maintenance' }),
  );
  // The purge row is written by the worker role, because ad_maintenance cannot insert (migration 0012).
  return { rollup: () => runNightlyRollup(db), ...makePrunes(maintenance, db) };
}

export function buildVideoHandlerDeps(
  env: WorkerEnv,
  boss: PgBoss,
  logger: Logger,
  db: Database = createWorkerDb(env),
): VideoHandlerDeps {
  // The local driver only signs dev urls, which the worker never hands out, so any stable secret will do.
  const signing = env.HLS_KEK;
  const originals = createStorage(storageConfigFromEnv(env, env.BUCKET_ORIGINALS, signing));
  const media = createStorage(storageConfigFromEnv(env, env.BUCKET_MEDIA, signing));
  const mirror = new DrizzleJobMirror(db);
  const producer = new JobProducer({ boss: bossAdapter(boss), mirror });
  const limits = { maxSeconds: env.MAX_VIDEO_SECONDS, warnSeconds: 3600 };
  const scratch = {
    root: env.WORKER_SCRATCH_DIR,
    minFreeRatio: env.WORKER_SCRATCH_MIN_FREE_RATIO,
  };

  const pipeline = new VideoPipeline({
    db,
    originals,
    media,
    keyring: keyring(env.HLS_KEK, env.HLS_KEK_PREVIOUS),
    producer,
    scratch,
    ffmpeg: { preset: env.FFMPEG_PRESET, threads: env.FFMPEG_THREADS || undefined },
    limits,
    logger,
  });

  const transcriber = chooseTranscriber(env);
  const captions = new CaptionGenerator({ db, originals, transcriber, scratch });

  return {
    pipeline,
    captions,
    images: new ImageService({ db, originals, media, logger }),
    lifecycle: new LifecycleService({ db, originals, media, producer, logger }),
    uploads: new UploadService({
      db,
      originals,
      media,
      producer,
      limits: { maxBytes: 5 * 1024 * MIB, partBytes: 8 * MIB },
      logger,
    }),
    mirror,
    logger,
    notifier: makeNotifier(db, logger),
  };
}

/**
 * The mail jobs (M15-S01, M21-S03). The site name comes from settings at send time, so a rename reaches the next
 * email. The worker has no access to theme colours, so those stay at the defaults. One SMTP attempt per run: the
 * outbox does the retrying, with its own waits.
 */
export function buildMailDeps(
  env: Pick<WorkerEnv, 'FIELD_KEK' | 'SMTP_URL' | 'EMAIL_FROM' | 'SUPPORT_EMAIL' | 'APP_ORIGIN'>,
  db: Database,
  options: { transport?: MailTransport } = {},
): Omit<MailDeps, 'mirror' | 'logger'> {
  const from = env.EMAIL_FROM;
  const supportEmail = env.SUPPORT_EMAIL ?? /<([^>]+)>/.exec(from)?.[1] ?? from;
  const kek = env.FIELD_KEK;
  const mailer = new Mailer(options.transport ?? transportFromSmtpUrl(env.SMTP_URL), {
    from,
    appName: 'Angels Delight TV',
    appOrigin: env.APP_ORIGIN,
    supportEmail,
    brand: async () => ({ appName: String(await readSetting(db, 'platform.name')) }),
  });
  return {
    queueImmediate: () => queueImmediateNotices({ db, kek }),
    drain: () => drainOutbox({ db, kek, mailer }),
    prune: () => pruneOutbox(db),
    digests: () => buildDigests({ db, kek }),
  };
}

/** The export jobs (M19-S05, M20-S03). Files go to the private originals bucket under `exports/`. */
export function buildExportDeps(
  env: WorkerEnv,
  db: Database,
  logger: Logger,
): Omit<ExportDeps, 'mirror' | 'logger'> {
  const storage = createStorage(storageConfigFromEnv(env, env.BUCKET_ORIGINALS, env.HLS_KEK));
  const rt = { db, storage, kek: env.FIELD_KEK, logger };
  return {
    generate: (exportId, options) => generateExport(rt, exportId, options),
    cleanup: () => cleanupExports(rt),
  };
}
