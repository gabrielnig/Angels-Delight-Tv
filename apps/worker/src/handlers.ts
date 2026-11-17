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
import type { CaptionGenerator, LifecycleService, UploadService, VideoPipeline } from '@ad/video';

export interface VideoHandlerDeps {
  pipeline: Pick<VideoPipeline, 'probe' | 'encode' | 'thumbnails' | 'rewrapKey' | 'failVideo'>;
  captions: Pick<CaptionGenerator, 'generate'>;
  lifecycle: Pick<LifecycleService, 'purge' | 'enqueueExpired'>;
  uploads: Pick<UploadService, 'cleanupExpired'>;
  mirror: JobMirror;
  logger: Logger;
}

/** Creates the queues, schedules the crons and registers one worker per lane D queue. */
export async function registerVideoHandlers(boss: BossLike, deps: VideoHandlerDeps): Promise<void> {
  const { pipeline, captions, lifecycle, uploads, mirror, logger } = deps;
  await ensureQueues(boss);
  await scheduleCrons(boss);

  const base = { mirror, logger, classify: classifyPipelineError };
  const failVideo = async (payload: { videoId: string }, failure: ClassifiedFailure) =>
    pipeline.failVideo(payload.videoId, failure);

  await registerWorker(boss, {
    ...base,
    queue: QUEUES.videoProbe,
    handle: (p, job) => pipeline.probe(p.videoId, job.progress),
    onFailed: failVideo,
  });
  await registerWorker(boss, {
    ...base,
    queue: QUEUES.videoEncode,
    handle: (p, job) => pipeline.encode(p.videoId, job.progress),
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
    handle: (p, job) => captions.generate(p.videoId, p.mode, job.progress, job.signal),
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
      if (result.failed > 0)
        throw new Error(`${result.failed} idle uploads could not be aborted`);
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

