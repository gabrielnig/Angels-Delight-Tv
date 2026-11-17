import { mkdir, rm, statfs } from 'node:fs/promises';
import { join } from 'node:path';
import { PipelineError } from '../failure';

export interface DiskStats {
  freeBytes: number;
  totalBytes: number;
}

export async function diskStats(dir: string): Promise<DiskStats> {
  await mkdir(dir, { recursive: true });
  const stats = await statfs(dir);
  return { freeBytes: stats.bavail * stats.bsize, totalBytes: stats.blocks * stats.bsize };
}

export interface ScratchOptions {
  root: string;
  /** Free space must be at least this many times the source size (ARCHITECTURE section 8.2). */
  sizeFactor?: number;
  /** And at least this share of the disk must stay free (M14-S07 AC2). */
  minFreeRatio?: number;
  stats?: (dir: string) => Promise<DiskStats>;
}

/**
 * Creates `root/{name}`, refuses when the disk is too full, and always removes the directory afterwards,
 * even when the work fails (M14-S07).
 */
export async function withScratch<T>(
  options: ScratchOptions,
  name: string,
  sourceBytes: number,
  fn: (dir: string) => Promise<T>,
): Promise<T> {
  const stats = await (options.stats ?? diskStats)(options.root);
  const needed = sourceBytes * (options.sizeFactor ?? 3);
  const ratio = stats.totalBytes > 0 ? stats.freeBytes / stats.totalBytes : 1;
  if (stats.freeBytes < needed || ratio < (options.minFreeRatio ?? 0.15)) {
    throw new PipelineError(
      'out_of_disk',
      `free ${stats.freeBytes} of ${stats.totalBytes} bytes, need ${needed}`,
    );
  }
  const dir = join(options.root, name);
  await rm(dir, { recursive: true, force: true });
  await mkdir(dir, { recursive: true, mode: 0o700 });
  try {
    return await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }
}
