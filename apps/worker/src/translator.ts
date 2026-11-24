import type { WorkerEnv } from '@ad/config';
import { FakeTranslator, GoogleTranslator, PipelineError, type Translator } from '@ad/video';

/**
 * The caption translation engine. Off by default: provider `none` refuses every job with a permanent
 * "not configured" error. `google` needs TRANSLATE_API_KEY. `fake` is for development and tests.
 */
export function chooseTranslator(
  env: Pick<WorkerEnv, 'TRANSLATE_PROVIDER' | 'TRANSLATE_API_KEY'>,
): Translator {
  if (env.TRANSLATE_PROVIDER === 'fake') return new FakeTranslator();
  if (env.TRANSLATE_PROVIDER === 'google' && env.TRANSLATE_API_KEY)
    return new GoogleTranslator({ apiKey: env.TRANSLATE_API_KEY });
  return {
    name: 'none',
    supports: () => false,
    translate: async () => {
      throw new PipelineError('caption_failed', 'TRANSLATE_PROVIDER is not configured', true);
    },
  };
}
