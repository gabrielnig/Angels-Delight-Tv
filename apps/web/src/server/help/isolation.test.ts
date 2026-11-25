import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Help files are not catalog titles (M50-S07 AC3, D-360). Nothing outside the admin help code may mention the help
 * routes or the help storage prefix, so the catalog, Home rows, search, sitemap, analytics and Kids cannot list them.
 */
const src = join(import.meta.dirname, '../..');
const ALLOWED = [
  /^components\/admin\//,
  /^app\/admin\//,
  /^lib\/admin\/help-/,
  /^server\/help\//,
  /^lib\/data\/admin\//,
  /^lib\/seo\/robots-rules/,
];

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return name === 'node_modules' ? [] : files(full);
    return /\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name) ? [full] : [];
  });
}

describe('help isolation', () => {
  it('no code outside the admin help area names the help routes or the help storage prefix', () => {
    const offenders = files(src)
      .map((f) => relative(src, f))
      .filter((rel) => !ALLOWED.some((re) => re.test(rel)))
      .filter((rel) =>
        /admin\/help|['"`]help\/\$\{|['"`]help\//.test(readFileSync(join(src, rel), 'utf8')),
      );
    expect(offenders).toEqual([]);
  });

  it('robots keeps the whole admin, and so the help pages, away from search engines', () => {
    expect(readFileSync(join(src, 'lib/seo/robots-rules.ts'), 'utf8')).toContain("'/admin'");
  });
});
