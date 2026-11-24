import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

export const repoRoot = resolve(import.meta.dirname, '../../..');

export type CssRule = {
  file: string;
  line: number;
  selector: string;
  body: string;
  /** Enclosing at-rule preludes, outermost first, for example "@media (hover: hover)". */
  at: string[];
};

/** Small brace-depth scanner. Handles comments and nested at-rules, which is all the guards need. */
export function scanCss(css: string, file = 'inline.css'): CssRule[] {
  const text = css.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
  const rules: CssRule[] = [];
  const stack: {
    prelude: string;
    isAt: boolean;
    start: number;
    bodyStart: number;
    line: number;
  }[] = [];
  let last = 0;
  let line = 1;
  let preludeLine = 1;
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];
    if (c === '\n') line += 1;
    if (c === '{') {
      const prelude = text.slice(last, i).trim();
      const startLine =
        preludeLine + (text.slice(last, i).match(/^\s*/)?.[0].split('\n').length ?? 1) - 1;
      stack.push({
        prelude,
        isAt: prelude.startsWith('@'),
        start: last,
        bodyStart: i + 1,
        line: startLine,
      });
      last = i + 1;
      preludeLine = line;
    } else if (c === '}') {
      const top = stack.pop();
      if (top) {
        const inner = text.slice(top.bodyStart, i);
        if (!top.isAt) {
          rules.push({
            file,
            line: top.line,
            selector: top.prelude,
            body: inner,
            at: stack.filter((s) => s.isAt).map((s) => s.prelude),
          });
        }
      }
      last = i + 1;
      preludeLine = line;
    } else if (c === ';' && stack.length === 0) {
      last = i + 1;
      preludeLine = line;
    }
  }
  return rules;
}

export function cssFiles(dirs: string[]): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      if (name === 'node_modules' || name === '.next' || name === 'dist') continue;
      const p = join(dir, name);
      if (statSync(p).isDirectory()) walk(p);
      else if (name.endsWith('.css')) out.push(p);
    }
  };
  for (const d of dirs) walk(resolve(repoRoot, d));
  return out.sort();
}

export function allRules(dirs = ['packages', 'apps/web/src']): CssRule[] {
  return cssFiles(dirs).flatMap((f) => scanCss(readFileSync(f, 'utf8'), relative(repoRoot, f)));
}

export const mediaIncludesHover = (at: string[]) =>
  at.some((a) => /\(\s*hover:\s*hover\s*\)/.test(a));
export const mediaIncludesFine = (at: string[]) =>
  at.some((a) => /\(\s*hover:\s*hover\s*\)/.test(a) && /\(\s*pointer:\s*fine\s*\)/.test(a));
