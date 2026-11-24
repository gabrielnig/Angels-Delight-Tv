import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The tools image runs TypeScript through tsx with no JSX settings, so any runtime import of the @ad/ui barrel
 * pulls in the React components and crashes `apply` with "React is not defined". The tools and the theme package
 * must take their runtime values from the pure "@ad/ui/theme" entry. Type only imports are erased and are fine.
 */
const roots = [resolve(import.meta.dirname), resolve(import.meta.dirname, '../../theme/src')];

function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(dir, entry.name);
    if (entry.isDirectory()) return sources(path);
    return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [path] : [];
  });
}

describe('tools image imports (M33)', () => {
  it('never loads the @ad/ui barrel at runtime from the launch or theme packages', () => {
    const offenders = roots.flatMap(sources).filter((file) => {
      const text = readFileSync(file, 'utf8');
      const imports = [...text.matchAll(/import\s+(type\s+)?([\s\S]*?)\s+from\s+'@ad\/ui'/g)];
      return imports.some(([, typeOnly, clause]) => {
        if (typeOnly) return false;
        const names = (clause ?? '')
          .replace(/[{}]/g, '')
          .split(',')
          .map((n) => n.trim())
          .filter(Boolean);
        return names.some((n) => !n.startsWith('type '));
      });
    });
    expect(offenders).toEqual([]);
  });

  it('exposes the pure theme entry', () => {
    const pkg = JSON.parse(
      readFileSync(resolve(import.meta.dirname, '../../ui/package.json'), 'utf8'),
    );
    expect(pkg.exports['./theme']).toBe('./src/theme.ts');
  });
});
