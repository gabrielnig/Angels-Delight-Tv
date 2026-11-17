import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PipelineError } from '../failure';
import { withScratch } from './scratch';

describe('withScratch', () => {
  let root: string;
  beforeAll(async () => {
    root = await mkdtemp(join(tmpdir(), 'ad-scratch-'));
  });
  afterAll(() => rm(root, { recursive: true, force: true }));

  const roomy = async () => ({ freeBytes: 1e12, totalBytes: 2e12 });

  it('gives the work a clean directory and removes it afterwards', async () => {
    let seen = '';
    await withScratch({ root, stats: roomy }, 'job-1', 100, async (dir) => {
      seen = dir;
      expect(dir).toBe(join(root, 'job-1'));
    });
    expect(await readdir(root)).not.toContain('job-1');
    expect(seen).not.toBe('');
  });

  it('removes the directory when the work throws', async () => {
    await expect(
      withScratch({ root, stats: roomy }, 'job-2', 100, async () => {
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
    expect(await readdir(root)).not.toContain('job-2');
  });

  it('defers with out_of_disk when space is under three times the source', async () => {
    const tight = async () => ({ freeBytes: 250, totalBytes: 1000 });
    const error = await withScratch(
      { root, stats: tight },
      'job-3',
      100,
      async () => undefined,
    ).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(PipelineError);
    expect((error as PipelineError).code).toBe('out_of_disk');
    expect((error as PipelineError).permanent).toBe(false);
  });

  it('defers when less than 15 percent of the disk is free', async () => {
    const full = async () => ({ freeBytes: 1e9, totalBytes: 1e10 });
    await expect(
      withScratch({ root, stats: full }, 'job-4', 10, async () => undefined),
    ).rejects.toMatchObject({
      code: 'out_of_disk',
    });
  });
});
