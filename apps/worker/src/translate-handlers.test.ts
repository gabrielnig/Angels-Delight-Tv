import { PipelineError } from '@ad/video';
import { FakeBoss, MemoryMirror } from '@ad/queue/testing';
import { createLogger } from '@ad/shared';
import { describe, expect, it } from 'vitest';
import { registerTranslateHandlers } from './translate-handlers';

const VID = '0192f0a0-0000-7000-8000-0000000000aa';

function setup(over: Record<string, unknown> = {}) {
  const calls: unknown[][] = [];
  const told: unknown[][] = [];
  const deps = {
    translator: { translate: async (...a: unknown[]) => void calls.push(a) },
    notifier: {
      translationReady: async (...a: unknown[]) => void told.push(['ready', ...a]),
      translationFailed: async (...a: unknown[]) => void told.push(['failed', ...a]),
    },
    mirror: new MemoryMirror(),
    logger: createLogger({ write: () => undefined }),
    ...over,
  };
  return { boss: new FakeBoss(), deps, calls, told };
}

describe('registerTranslateHandlers', () => {
  it('registers only the caption.translate queue', async () => {
    const { boss, deps } = setup();
    await registerTranslateHandlers(boss, deps as never);
    expect([...boss.handlers.keys()]).toEqual(['caption.translate']);
  });

  it('success notifies the staff bell for the language', async () => {
    const { boss, deps, calls, told } = setup();
    await registerTranslateHandlers(boss, deps as never);
    await boss.send('caption.translate', { videoId: VID, targetLanguage: 'yo' });
    await boss.drain('caption.translate');
    expect(calls[0]!.slice(0, 3)).toEqual([VID, 'yo', { sourceCaptionId: undefined }]);
    expect(told).toEqual([['ready', VID, 'yo']]);
  });

  it('failure notifies once after the retries are used', async () => {
    const { boss, deps, told } = setup({
      translator: {
        translate: async () => {
          throw new Error('provider down');
        },
      },
    });
    await registerTranslateHandlers(boss, deps as never);
    await boss.send('caption.translate', { videoId: VID, targetLanguage: 'ha' });
    await boss.drain('caption.translate');
    expect(told).toEqual([['failed', VID, 'ha']]);
  });

  it('a permanent error is not retried and still notifies once', async () => {
    let runs = 0;
    const { boss, deps, told } = setup({
      translator: {
        translate: async () => {
          runs += 1;
          throw new PipelineError('caption_failed', 'not configured', true);
        },
      },
    });
    await registerTranslateHandlers(boss, deps as never);
    await boss.send('caption.translate', { videoId: VID, targetLanguage: 'yo' });
    await boss.drain('caption.translate');
    expect(runs).toBe(1);
    expect(told).toEqual([['failed', VID, 'yo']]);
  });

  it('a notice that cannot be sent never changes the job result', async () => {
    const { boss, deps } = setup({
      notifier: {
        translationReady: async () => {
          throw new Error('bell down');
        },
        translationFailed: async () => undefined,
      },
    });
    await registerTranslateHandlers(boss, deps as never);
    await boss.send('caption.translate', { videoId: VID, targetLanguage: 'yo' });
    await expect(boss.drain('caption.translate')).resolves.not.toThrow();
  });
});
