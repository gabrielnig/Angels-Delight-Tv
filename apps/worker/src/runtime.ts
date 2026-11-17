import type { WorkerEnv } from '@ad/config';
import { createDb, createPool } from '@ad/db';
import { DrizzleJobMirror, JobProducer, bossAdapter } from '@ad/queue';
import type { Logger } from '@ad/shared';
import { createStorage, storageConfigFromEnv } from '@ad/storage';
import {
  CaptionGenerator,
  HttpWhisperClient,
  LifecycleService,
  PipelineError,
  UploadService,
  VideoPipeline,
  keyring,
  type Transcriber,
} from '@ad/video';
import type { PgBoss } from 'pg-boss';
import type { VideoHandlerDeps } from './handlers';

// Cleanup never validates new uploads, so the limits here are placeholders.
const MIB = 1024 * 1024;

/** Builds the lane D services from the worker environment. Kept apart from boot so boot stays testable. */
export function buildVideoHandlerDeps(env: WorkerEnv, boss: PgBoss, logger: Logger): VideoHandlerDeps {
  const db = createDb(createPool(env.DATABASE_URL_WORKER, { max: 4 }));
  // The local driver only signs dev urls, which the worker never hands out, so any stable secret will do.
  const signing = env.HLS_KEK;
  const originals = createStorage(storageConfigFromEnv(env, env.BUCKET_ORIGINALS, signing));
  const media = createStorage(storageConfigFromEnv(env, env.BUCKET_MEDIA, signing));
  const mirror = new DrizzleJobMirror(db);
  const producer = new JobProducer({ boss: bossAdapter(boss), mirror });
  const limits = { maxSeconds: env.MAX_VIDEO_SECONDS, warnSeconds: 3600 };
  const scratch = { root: env.WORKER_SCRATCH_DIR };

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

  const transcriber: Transcriber = env.WHISPER_URL
    ? new HttpWhisperClient({ baseUrl: env.WHISPER_URL })
    : {
        transcribe: async () => {
          throw new PipelineError('caption_failed', 'WHISPER_URL is not configured', true);
        },
      };
  const captions = new CaptionGenerator({ db, originals, transcriber, scratch });

  return {
    pipeline,
    captions,
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
  };
}
