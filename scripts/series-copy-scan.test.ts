import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * M51: the owner words the groups and items of a series, so no screen may carry the words Season or Episode or
 * a code like E4 in its own copy. Every phrase goes through `@ad/shared` series-labels. This scan fails on any
 * remaining literal outside the allowlist.
 */

const root = resolve(import.meta.dirname, '..');

/** Files and folders where the words are data or the preset catalog, not copy. Keep this list short and reasoned. */
const ALLOW_PATHS = [
  // The preset words and the one helper that builds every phrase.
  'packages/shared/src/messages/l13-messages.ts',
  'packages/shared/src/series-labels.ts',
  // Demo content and test fixtures are sample data, not interface copy.
  'apps/web/src/lib/data/fixtures/',
  'packages/catalog/src/testing/',
  'packages/catalog/src/seed-demo.ts',
  // Table, column and enum names are schema, not copy.
  'packages/db/src/schema/',
  'packages/shared/src/enums.ts',
  // The import file format names its columns season and episode, so those words are the file's vocabulary.
  'packages/launch/src/import/manifest.ts',
  // Translation drafts and old catalogs of other lanes are checked by the messages tests.
  'packages/shared/src/messages/drafts/',
  'packages/shared/src/messages/locales/',
];

const ALLOW_LINES: RegExp[] = [
  /@type['"]?:\s*'TVEpisode'|'TVSeason'|'TVSeries'/, // schema.org vocabulary
  /^\s*(import|export)\b.*\bfrom\b/, // module paths
  /\['(season|episode)s?'\]/, // type indexes such as SeriesDetail['seasons']
];

const SKIP_DIRS = new Set(['node_modules', '.next', 'dist', 'coverage', '.turbo']);

function files(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) files(full, out);
    else if (/\.(ts|tsx)$/.test(name) && !/\.(test|int\.test|d)\.tsx?$/.test(name) && !name.endsWith('.stories.tsx')) out.push(full);
  }
  return out;
}

const SQL = /\b(FROM|JOIN|INTO|UPDATE) (episodes|seasons)\b|\bsql(\.raw)?`|\b(episodes|seasons)\.\w+/;

/** Drops what is code, not words a person reads: attribute ids, template expressions, message keys, braces. */
function codeOnlyRemoved(input: string): string {
  let line = input.replace(
    /\b(className|id|key|htmlFor|aria-labelledby|aria-describedby|data-[\w-]+|value|name|href|src)=("[^"]*"|\{[^}]*\})/g,
    '',
  );
  line = line.replace(/\$\{[^}]*\}/g, '');
  line = line.replace(/(['"])[a-z][\w]*(\.[\w]+)+\1/g, '');
  for (let i = 0; i < 3; i++) line = line.replace(/\{[^{}'"`]*\}/g, '');
  return line;
}

/** A bare 'episode' is data only on a line that is about kinds or URL parameters. */
const CODE_LINE = /\bkind\b|\btitleKind\b|searchParams|\.(set|get)\(|\bintent\b/;

const WORD = /\b(season|episode)s?\b/gi;
const CODE = /`(?:S\$\{[^}]*\}\s?)?E\$\{|`S\$\{[^}]*\} E\$\{/;

function insideString(line: string, index: number): boolean {
  const before = line.slice(0, index);
  for (const quote of ["'", '"', '`']) {
    const count = before.split(quote).length - 1;
    if (count % 2 === 1) return true;
  }
  return false;
}

function insideJsxText(line: string, index: number): boolean {
  const open = line.lastIndexOf('>', index);
  const close = line.indexOf('<', index);
  return open !== -1 && close !== -1 && !line.slice(open + 1, index).includes('<') && !line.slice(open, index).includes('=>');
}

export function scan(): string[] {
  const hits: string[] = [];
  const targets = [join(root, 'apps/web/src')];
  for (const pkg of readdirSync(join(root, 'packages'))) targets.push(join(root, 'packages', pkg, 'src'));
  for (const dir of targets) {
    let list: string[] = [];
    try {
      list = files(dir);
    } catch {
      continue;
    }
    for (const file of list) {
      const rel = relative(root, file);
      if (ALLOW_PATHS.some((p) => rel.startsWith(p) || rel === p)) continue;
      const lines = readFileSync(file, 'utf8').split('\n');
      let inBlock = false;
      lines.forEach((raw, i) => {
        let line = raw;
        if (inBlock) {
          if (line.includes('*/')) inBlock = false;
          return;
        }
        if (/^\s*\/\*/.test(line) && !line.includes('*/')) {
          inBlock = true;
          return;
        }
        if (/^\s*(\/\/|\*|\/\*)/.test(line)) return;
        line = line.replace(/\/\/.*$/, (m, off: number) => (insideString(raw, off) ? m : ''));
        if (ALLOW_LINES.some((re) => re.test(line))) return;
        if (CODE.test(line)) hits.push(`${rel}:${i + 1}: ${raw.trim()}`);
        line = codeOnlyRemoved(line);
        if (SQL.test(line)) return;
        for (const m of line.matchAll(WORD)) {
          const index = m.index ?? 0;
          if (!insideString(line, index) && !insideJsxText(line, index)) continue;
          // A literal that is only a code word such as 'episode' is data, not copy.
          const literal = /(['"`])([^'"`]*)\1/g;
          let bareData = false;
          for (const l of line.matchAll(literal)) {
            const start = l.index ?? 0;
            if (
              index > start &&
              index < start + l[0].length &&
              /^(season|episode)s?$/.test(l[2] ?? '') &&
              CODE_LINE.test(line)
            )
              bareData = true;
          }
          if (bareData) continue;
          hits.push(`${rel}:${i + 1}: ${raw.trim()}`);
          break;
        }
      });
    }
  }
  return hits;
}

describe('no hardcoded Season or Episode copy (M51-S03)', () => {
  it('finds none outside the allowlist', () => {
    expect(scan()).toEqual([]);
  });
});
