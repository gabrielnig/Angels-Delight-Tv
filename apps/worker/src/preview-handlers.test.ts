import { FakeBoss, MemoryMirror } from '@ad/queue/testing';
import { createLogger } from '@ad/shared';
import { describe, expect, it } from 'vitest';
import { registerPreviewHandlers } from './preview-handlers';

const videoId = '0192f0a0-0000-7000-8000-0000000000aa';

function setup() {
  const calls: unknown[][] = [];
  const boss = new FakeBoss();
  const deps = {
    pipeline: {
      previewClip: async (...args: unknown[]) => void calls.push(['clip', ...args.slice(0, 2)]),
      sweepPreviews: async () => (calls.push(['sweep']), 3),
    },
    mirror: new MemoryMirror(),
    logger: createLogger({ write: () => undefined }),
  };
  return { boss, deps, calls };
}

describe('registerPreviewHandlers', () => {
  it('registers the clip queue and the sweep, and schedules the sweep hourly in Lagos time', async () => {
    const { boss, deps } = setup();
    await registerPreviewHandlers(boss, deps as never);
    expect([...boss.handlers.keys()].sort()).toEqual(['video.preview', 'video.preview_sweep']);
    expect(boss.schedules).toEqual([
      expect.objectContaining({ name: 'video.preview_sweep', cron: '20 * * * *' }),
    ]);
  });

  it('runs a clip job with the mode and start from the payload', async () => {
    const { boss, deps, calls } = setup();
    await registerPreviewHandlers(boss, deps as never);
    await boss.send('video.preview', { videoId, mode: 'picked', startMs: 12_300 });
    await boss.drain('video.preview');
    expect(calls).toEqual([['clip', videoId, { mode: 'picked', startMs: 12_300 }]]);
  });

  it('runs a plain clip job with no options', async () => {
    const { boss, deps, calls } = setup();
    await registerPreviewHandlers(boss, deps as never);
    await boss.send('video.preview', { videoId });
    await boss.drain('video.preview');
    expect(calls).toEqual([['clip', videoId, {}]]);
  });

  it('runs the sweep', async () => {
    const { boss, deps, calls } = setup();
    await registerPreviewHandlers(boss, deps as never);
    await boss.send('video.preview_sweep', {});
    await boss.drain('video.preview_sweep');
    expect(calls).toEqual([['sweep']]);
  });
});
