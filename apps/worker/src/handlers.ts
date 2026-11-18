import {
  QUEUES,
  ensureQueues,
  registerWorker,
  scheduleCrons,
  type BossLike,
  type ClassifiedFailure,
  type JobMirror,
} from '@ad/queue';
import type { Logger } from '@ad/shared';
import { classifyPipelineError } from '@ad/video';
import type {
  CaptionGenerator,
  ImageService,
  LifecycleService,
  UploadService,
  VideoPipeline,
} from '@ad/video';

export interface VideoHandlerDeps {
  pipeline: Pick<VideoPipeline, 'probe' | 'encode' | 'thumbnails' | 'rewrapKey' | 'failVideo'>;
  captions: Pick<CaptionGenerator, 'generate'>;
  images: Pick<ImageService, 'process'>;
  lifecycle: Pick<LifecycleService, 'purge' | 'enqueueExpired'>;
  uploads: Pick<UploadService, 'cleanupExpired'>;
  mirror: JobMirror;
  logger: Logger;
  /** Puts job results in the staff bell (M21-S03). Optional so a worker without it still runs jobs. */
  notifier?: StaffNotifier;
}

export interface StaffNotifier {
  encodeDone(videoId: string): Promise<void>;
  encodeFailed(videoId: string, reason: string): Promise<void>;
  captionsReady(videoId: string): Promise<void>;
  captionsFailed(videoId: string): Promise<void>;
}

/** Creates the queues, schedules the crons and registers one worker per lane D queue. */
export async function registerVideoHandlers(boss: BossLike, deps: VideoHandlerDeps): Promise<void> {
  const { pipeline, captions, images, lifecycle, uploads, mirror, logger, notifier } = deps;
  await ensureQueues(boss);
  await scheduleCrons(boss);

  const base = { mirror, logger, classify: classifyPipelineError };
  /** A notice never decides whether a job worked: a failure to send is logged and the job result stands. */
  const tell = async (send: (n: StaffNotifier) => Promise<void>) => {
    if (!notifier) return;
    try {
      await send(notifier);
    } catch (err) {
      logger.warn('staff notice not sent', { err });
    }
  };
  const failVideo = async (payload: { videoId: string }, failure: ClassifiedFailure) => {
    await pipeline.failVideo(payload.videoId, failure);
    await tell((n) => n.encodeFailed(payload.videoId, failure.plain));
  };

  await registerWorker(boss, {
    ...base,
    queue: QUEUES.videoProbe,
    handle: (p, job) => pipeline.probe(p.videoId, job.progress),
    onFailed: failVideo,
  });
  await registerWorker(boss, {
    ...base,
    queue: QUEUES.videoEncode,
    async handle(p, job) {
      await pipeline.encode(p.videoId, job.progress);
      await tell((n) => n.encodeDone(p.videoId));
    },
    onFailed: failVideo,
  });
  await registerWorker(boss, {
    ...base,
    queue: QUEUES.videoThumbnails,
    handle: (p, job) => pipeline.thumbnails(p.videoId, job.progress),
    onFailed: failVideo,
  });
  await registerWorker(boss, {
    ...base,
    queue: QUEUES.captionGenerate,
    async handle(p, job) {
      await captions.generate(p.videoId, p.mode, job.progress, job.signal);
      await tell((n) => n.captionsReady(p.videoId));
    },
    onFailed: (p) => tell((n) => n.captionsFailed(p.videoId)),
  });
  await registerWorker(boss, {
    ...base,
    queue: QUEUES.imageProcess,
    handle: (p) => images.process(p.assetId),
  });
  await registerWorker(boss, {
    ...base,
    queue: QUEUES.videoRekey,
    handle: (p) => pipeline.rewrapKey(p.videoId),
  });
  await registerWorker(boss, {
    ...base,
    queue: QUEUES.videoPurge,
    handle: (p) => lifecycle.purge(p.videoId),
  });
  await registerWorker(boss, {
    ...base,
    queue: QUEUES.uploadsCleanup,
    async handle() {
      const result = await uploads.cleanupExpired();
      if (result.failed > 0) throw new Error(`${result.failed} idle uploads could not be aborted`);
    },
  });
  await registerWorker(boss, {
    ...base,
    queue: QUEUES.videosPurgeDeleted,
    async handle() {
      await lifecycle.enqueueExpired();
    },
  });
}
