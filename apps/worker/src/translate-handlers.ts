import {
  QUEUES,
  ensureQueues,
  registerWorker,
  type BossLike,
  type JobMirror,
} from '@ad/queue';
import type { Logger } from '@ad/shared';
import { classifyPipelineError } from '@ad/video';
import type { CaptionTranslator } from '@ad/video';

export interface TranslateNotifier {
  translationReady(videoId: string, language: string): Promise<void>;
  translationFailed(videoId: string, language: string): Promise<void>;
}

export interface TranslateDeps {
  translator: Pick<CaptionTranslator, 'translate'>;
  mirror: JobMirror;
  logger: Logger;
  /** Optional so a worker without it still runs jobs. A failed notice never decides the job result. */
  notifier?: TranslateNotifier;
}

/** `caption.translate` (M46). One registration, kept apart from the video handlers. */
export async function registerTranslateHandlers(boss: BossLike, deps: TranslateDeps): Promise<void> {
  const { translator, mirror, logger, notifier } = deps;
  await ensureQueues(boss);
  const tell = async (send: (n: TranslateNotifier) => Promise<void>) => {
    if (!notifier) return;
    try {
      await send(notifier);
    } catch (err) {
      logger.warn('staff notice not sent', { err });
    }
  };
  await registerWorker(boss, {
    mirror,
    logger,
    classify: classifyPipelineError,
    queue: QUEUES.captionTranslate,
    async handle(p, job) {
      await translator.translate(
        p.videoId,
        p.targetLanguage,
        { sourceCaptionId: p.sourceCaptionId },
        job.progress,
      );
      await tell((n) => n.translationReady(p.videoId, p.targetLanguage));
    },
    onFailed: (p) => tell((n) => n.translationFailed(p.videoId, p.targetLanguage)),
  });
}
