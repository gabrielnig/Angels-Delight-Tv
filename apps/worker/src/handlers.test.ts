import { PermanentJobError } from '@ad/queue';
import { FakeBoss, MemoryMirror } from '@ad/queue/testing';
import { createLogger } from '@ad/shared';
import { describe, expect, it } from 'vitest';
import { registerVideoHandlers } from './handlers';

const VID = '0192f0a0-0000-7000-8000-0000000000aa';

function setup(overrides: Record<string, unknown> = {}) {
  const calls: unknown[][] = [];
  const rec = (name: string) => async (...args: unknown[]) => void calls.push([name, ...args]);
  const failed: unknown[][] = [];
  const deps = {
    pipeline: {
      probe: rec('probe'),
      encode: rec('encode'),
      thumbnails: rec('thumbnails'),
      rewrapKey: rec('rekey'),
      failVideo: async (...a: unknown[]) => void failed.push(a),
    },
    captions: { generate: rec('caption') },
    images: { process: rec('image') },
    lifecycle: {
      purge: rec('purge'),
      enqueueExpired: async () => (calls.push(['expired']), { queued: 0 }),
    },
    uploads: { cleanupExpired: async () => (calls.push(['cleanup']), { expired: 1, failed: 0 }) },
    mirror: new MemoryMirror(),
    logger: createLogger({ write: () => undefined }),
    ...overrides,
  };
  const boss = new FakeBoss();
  return { boss, deps, calls, failed };
}

describe('registerVideoHandlers', () => {
  it('registers every lane D queue, creates them and schedules the crons', async () => {
    const { boss, deps } = setup();
    await registerVideoHandlers(boss, deps as never);
    expect([...boss.handlers.keys()].sort()).toEqual(
      [
        'caption.generate',
        'image.process',
        'uploads.cleanup',
        'video.encode',
        'video.probe',
        'video.purge',
        'video.rekey',
        'video.thumbnails',
        'videos.purge_deleted',
      ].sort(),
    );
    expect(boss.schedules.map((s) => s.name).sort()).toEqual(['uploads.cleanup', 'videos.purge_deleted']);
  });

  it('runs a probe job through the pipeline', async () => {
    const { boss, deps, calls } = setup();
    await registerVideoHandlers(boss, deps as never);
    await boss.send('video.probe', { videoId: VID });
    await boss.drain('video.probe');
    expect(calls[0]?.[0]).toBe('probe');
    expect(calls[0]?.[1]).toBe(VID);
  });

  it('runs an image job through the image service', async () => {
    const { boss, deps, calls } = setup();
    await registerVideoHandlers(boss, deps as never);
    await boss.send('image.process', { assetId: VID });
    await boss.drain('image.process');
    expect(calls[0]).toEqual(['image', VID]);
  });

  it('passes the caption mode through', async () => {
    const { boss, deps, calls } = setup();
    await registerVideoHandlers(boss, deps as never);
    await boss.send('caption.generate', { videoId: VID, mode: 'align' });
    await boss.drain('caption.generate');
    expect(calls[0]?.slice(0, 3)).toEqual(['caption', VID, 'align']);
  });

  it('fails the video once when a permanent error ends an encode', async () => {
    const { boss, deps, failed } = setup();
    (deps.pipeline as { encode: unknown }).encode = async () => {
      throw new PermanentJobError('bad file');
    };
    await registerVideoHandlers(boss, { ...deps, classify: undefined } as never);
    await boss.send('video.encode', { videoId: VID });
    await boss.drain('video.encode');
    expect(failed).toHaveLength(1);
    expect(failed[0]?.[0]).toBe(VID);
  });

  it('makes the cleanup job fail loudly when an abort keeps failing', async () => {
    const { boss, deps } = setup({
      uploads: { cleanupExpired: async () => ({ expired: 0, failed: 2 }) },
    });
    await registerVideoHandlers(boss, deps as never);
    await boss.send('uploads.cleanup', {});
    await expect(boss.drain('uploads.cleanup')).resolves.toBeGreaterThan(0);
  });

  it('runs the daily purge cron and hourly cleanup', async () => {
    const { boss, deps, calls } = setup();
    await registerVideoHandlers(boss, deps as never);
    await boss.send('videos.purge_deleted', {});
    await boss.drain('videos.purge_deleted');
    await boss.send('uploads.cleanup', {});
    await boss.drain('uploads.cleanup');
    expect(calls.map((c) => c[0])).toEqual(['expired', 'cleanup']);
  });
});
