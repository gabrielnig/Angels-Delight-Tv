import { access, mkdir, rename, rm } from 'node:fs/promises';
import { dirname } from 'node:path';

/**
 * Moves a finished working directory over the published one. The old files go only after the new ones exist, so a
 * failed recording leaves the previous files untouched (M50-S15).
 */
export async function replaceDir(work: string, final: string): Promise<void> {
  await access(work);
  await mkdir(dirname(final), { recursive: true });
  const old = `${final}.old`;
  await rm(old, { recursive: true, force: true });
  const hadOld = await access(final).then(
    () => true,
    () => false,
  );
  if (hadOld) await rename(final, old);
  try {
    await rename(work, final);
  } catch (e) {
    if (hadOld) await rename(old, final);
    throw e;
  }
  await rm(old, { recursive: true, force: true });
}
