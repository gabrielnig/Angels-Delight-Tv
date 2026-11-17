import type { WorkerEnv } from '@ad/config';
import { FakeTranscriber, HttpWhisperClient, PipelineError, type Transcriber } from '@ad/video';

/** A fixed sentence spread over the first six seconds, so the review and approve flow has real cues to show. */
const SCRIPT = 'Welcome to Angels Delight TV. This is a short sample lesson for testing captions.'
  .split(' ')
  .map((word, index) => ({ word, startMs: index * 450, endMs: index * 450 + 400 }));

/**
 * The speech recogniser for caption jobs: the faster-whisper service when `WHISPER_URL` is set, a scripted fake when
 * `WHISPER_FAKE=true` (development and tests, rejected in production), otherwise a permanent "not configured" error.
 */
export function chooseTranscriber(
  env: Pick<WorkerEnv, 'WHISPER_URL' | 'WHISPER_FAKE'>,
): Transcriber {
  if (env.WHISPER_FAKE) return new FakeTranscriber({ words: SCRIPT, model: 'fake' });
  if (env.WHISPER_URL) return new HttpWhisperClient({ baseUrl: env.WHISPER_URL });
  return {
    transcribe: async () => {
      throw new PipelineError('caption_failed', 'WHISPER_URL is not configured', true);
    },
  };
}
