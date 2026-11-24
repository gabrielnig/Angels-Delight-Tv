import { describe, expect, it } from 'vitest';
import { runCleanupMany } from './encode-bulk';

describe('runCleanupMany', () => {
  it('cleans each id alone, reports failures, and totals what was freed', async () => {
    const cleanup = async (id: string) => {
      if (id === 'bad') return { ok: false as const, error: 'Only a failed video can be cleaned up.' };
      if (id === 'boom') throw new Error('db down');
      return { ok: true as const, videos: 1, removedFiles: 3, freedBytes: 100 };
    };
    const out = await runCleanupMany(cleanup, ['a', 'bad', 'boom', 'b']);
    expect(out.succeeded).toEqual(['a', 'b']);
    expect(out.failed).toEqual([
      { id: 'bad', reason: 'Only a failed video can be cleaned up.', retryable: false },
      { id: 'boom', reason: 'Could not clean up. Try again.', retryable: true },
    ]);
    expect(out.removedFiles).toBe(6);
    expect(out.freedBytes).toBe(200);
  });
});
