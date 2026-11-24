import {
  PREVIEW_CRON_SCHEDULES,
  QUEUES,
  ensureQueues,
  registerWorker,
  scheduleCrons,
  type BossLike,
  type JobMirror,
} from '@ad/queue';
import type { Logger } from '@ad/shared';
import { classifyPipelineError, type VideoPipeline } from '@ad/video';

export interface PreviewHandlerDeps {
  pipeline: Pick<VideoPipeline, 'previewClip' | 'sweepPreviews'>;
  mirror: JobMirror;
  logger: Logger;
}

/**
 * The Home hero preview clip jobs (M41). A clip never fails its video, so there is no failVideo hook here: the
 * pipeline records `failed` or `skipped` on the video and the hero shows the poster.
 */
export async function registerPreviewHandlers(boss: BossLike, deps: PreviewHandlerDeps): Promise<void> {
  const { pipeline, mirror, logger } = deps;
  await ensureQueues(boss);
  const base = { mirror, logger, classify: classifyPipelineError };
  await registerWorker(boss, {
    ...base,
    queue: QUEUES.videoPreview,
    handle: (p, job) =>
      pipeline.previewClip(
        p.videoId,
        {
          ...(p.mode ? { mode: p.mode } : {}),
          ...(p.startMs !== undefined ? { startMs: p.startMs } : {}),
        },
        job.progress,
      ),
  });
  await registerWorker(boss, {
    ...base,
    queue: QUEUES.videoPreviewSweep,
    async handle() {
      const queued = await pipeline.sweepPreviews();
      logger.info('preview sweep finished', { queued });
    },
  });
  await scheduleCrons(boss, PREVIEW_CRON_SCHEDULES);
}
