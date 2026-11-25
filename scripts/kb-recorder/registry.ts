import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { Episode } from './episode';

export const EPISODES_DIR = join(import.meta.dirname, 'episodes');

/** Ids of every episode file in `episodes/` (file name without extension), sorted. */
export async function listEpisodeIds(dir = EPISODES_DIR): Promise<string[]> {
  const names = await readdir(dir);
  return names
    .filter((n) => n.endsWith('.ts') && !n.endsWith('.test.ts') && n !== 'index.ts')
    .map((n) => n.slice(0, -3))
    .sort();
}

export async function loadEpisode(id: string, dir = EPISODES_DIR): Promise<Episode> {
  const mod = (await import(pathToFileURL(join(dir, `${id}.ts`)).href)) as { default?: Episode };
  if (!mod.default) throw new Error(`Episode file ${id}.ts has no default export`);
  return mod.default;
}

export async function loadAllEpisodes(dir = EPISODES_DIR): Promise<Episode[]> {
  const ids = await listEpisodeIds(dir);
  return Promise.all(ids.map((id) => loadEpisode(id, dir)));
}
