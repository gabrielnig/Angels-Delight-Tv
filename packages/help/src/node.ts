import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { parseArticle, type Article } from './article';
import { parseGlossary } from './glossary';
import { buildLibrary, type Library } from './library';
import { lintArticle } from './lint';
import type { Block } from './markdown';

/** Largest allowed screenshot, plan L14 section 12.3 (media budget). */
export const MAX_IMAGE_BYTES = 120 * 1024;

/** The help content folder: HELP_CONTENT_DIR, or content/help found by walking up from a start folder. */
export function findContentDir(from: string = process.cwd()): string {
  const fromEnv = process.env.HELP_CONTENT_DIR;
  if (fromEnv) return resolve(fromEnv);
  let dir = resolve(/*turbopackIgnore: true*/ from);
  for (;;) {
    const candidate = join(dir, 'content', 'help');
    if (existsSync(join(candidate, 'en'))) return candidate;
    const up = dirname(dir);
    if (up === dir) throw new Error('Could not find content/help. Set HELP_CONTENT_DIR.');
    dir = up;
  }
}

function markdownFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = join(dir, e.name);
    if (e.isDirectory()) return markdownFiles(full);
    return e.name.endsWith('.md') && e.name !== 'glossary.md' ? [full] : [];
  });
}

export function loadArticles(contentDir: string): Article[] {
  return markdownFiles(join(contentDir, 'en'))
    .sort()
    .map((file) =>
      parseArticle(
        file.slice(resolve(contentDir, '..', '..').length + 1) || file,
        readFileSync(file, 'utf8'),
      ),
    );
}

/** Reads every article and the glossary and joins them. Throws with the file name when anything is wrong. */
export function loadLibrary(contentDir: string = findContentDir()): Library {
  const glossaryFile = join(contentDir, 'en', 'glossary.md');
  const glossary = existsSync(glossaryFile)
    ? parseGlossary(readFileSync(glossaryFile, 'utf8'))
    : [];
  return buildLibrary(loadArticles(contentDir), glossary);
}

function images(blocks: Block[]): string[] {
  return blocks.flatMap((b) =>
    b.t === 'image'
      ? [b.src]
      : b.t === 'ul' || b.t === 'ol'
        ? b.items.flatMap((i) => images(i.blocks))
        : [],
  );
}

/** Everything the build must refuse: copy lint, missing or oversized pictures. Empty means clean. */
export function checkContent(contentDir: string = findContentDir()): string[] {
  const lib = loadLibrary(contentDir);
  const problems: string[] = [];
  for (const a of lib.articles) {
    problems.push(...lintArticle(a));
    for (const src of [
      ...images(a.what),
      ...images(a.before),
      ...a.steps.flatMap((s) => images(s.blocks)),
      ...images(a.see),
    ]) {
      const file = join(contentDir, 'media', src);
      if (!existsSync(file))
        problems.push(`${a.file}: the picture "${src}" is not in content/help/media`);
      else if (statSync(file).size > MAX_IMAGE_BYTES)
        problems.push(`${a.file}: the picture "${src}" is over ${MAX_IMAGE_BYTES / 1024} KB`);
    }
  }
  return problems;
}

let cached: { dir: string; lib: Library } | undefined;
/** The library for the running server, read once. Restart to pick up a content change (dev reloads on every call). */
export function getLibrary(): Library {
  const dir = findContentDir();
  if (process.env.NODE_ENV !== 'production') return loadLibrary(dir);
  if (!cached || cached.dir !== dir) cached = { dir, lib: loadLibrary(dir) };
  return cached.lib;
}
