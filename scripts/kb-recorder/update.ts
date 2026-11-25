import { copyFileSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Episode } from './episode';
import { applyStepsBlock } from './steps-block';

/** The article file of an id under `content/help/en/<path>/<ID>-<slug>.md`, or null when it does not exist yet. */
export function findArticle(contentDir: string, id: string): string | null {
  const en = join(contentDir, 'en');
  for (const path of readdirSync(en, { withFileTypes: true })) {
    if (!path.isDirectory()) continue;
    for (const f of readdirSync(join(en, path.name))) {
      if (f.startsWith(`${id}-`) && f.endsWith('.md')) return join(en, path.name, f);
    }
  }
  return null;
}

/** Rewrites the `kb:steps` block of the article of this episode. Returns the file, or null when there is no article. */
export function updateArticleSteps(contentDir: string, episode: Episode): string | null {
  const file = findArticle(contentDir, episode.id);
  if (!file) return null;
  writeFileSync(file, applyStepsBlock(readFileSync(file, 'utf8'), episode));
  return file;
}

/** Copies the screenshots of a run into the committed baseline folder `content/help/media/<ID>/` for review. */
export function copyShotsToBaseline(
  contentDir: string,
  id: string,
  runDir: string,
  files: string[],
): string[] {
  const dest = join(contentDir, 'media', id);
  mkdirSync(dest, { recursive: true });
  return files.map((f) => {
    const name = f.split('/').pop()!;
    copyFileSync(join(runDir, f), join(dest, name));
    return join(dest, name);
  });
}
