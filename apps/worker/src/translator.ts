import type { WorkerEnv } from '@ad/config';
import {
  FakeTranslator,
  GoogleTranslator,
  PipelineError,
  withUsageCap,
  type Translator,
  type UsageStore,
} from '@ad/video';

/**
 * The caption translation engine. Off by default: provider `none` refuses every job with a permanent
 * "not configured" error. `google` needs TRANSLATE_API_KEY and a usage store, and every call is held to TRANSLATE_MONTHLY_CHAR_CAP (a paid
 * API never runs uncapped: without a store it behaves as not configured). `fake` is for development and tests.
 */
export function chooseTranslator(
  env: Pick<WorkerEnv, 'TRANSLATE_PROVIDER' | 'TRANSLATE_API_KEY' | 'TRANSLATE_MONTHLY_CHAR_CAP'>,
  usage?: UsageStore,
): Translator {
  if (env.TRANSLATE_PROVIDER === 'fake') return new FakeTranslator();
  if (env.TRANSLATE_PROVIDER === 'google' && env.TRANSLATE_API_KEY && usage)
    return withUsageCap(new GoogleTranslator({ apiKey: env.TRANSLATE_API_KEY }), {
      store: usage,
      cap: env.TRANSLATE_MONTHLY_CHAR_CAP,
    });
  return {
    name: 'none',
    supports: () => false,
    translate: async () => {
      throw new PipelineError('caption_failed', 'TRANSLATE_PROVIDER is not configured', true);
    },
  };
}
