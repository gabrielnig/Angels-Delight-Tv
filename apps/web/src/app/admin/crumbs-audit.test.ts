import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = join(new URL('.', import.meta.url).pathname, '(shell)');

function pages(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return pages(full);
    return name === 'page.tsx' ? [full] : [];
  });
}

/** Every `crumbs={[ ... ]}` array literal in a page, as the text between the brackets. */
function crumbArrays(src: string): string[] {
  const out: string[] = [];
  const re = /crumbs=\{\[/g;
  while (re.exec(src)) {
    let depth = 1;
    let i = re.lastIndex;
    while (i < src.length && depth > 0) {
      if (src[i] === '[') depth += 1;
      if (src[i] === ']') depth -= 1;
      i += 1;
    }
    out.push(src.slice(re.lastIndex, i - 1));
  }
  return out;
}

/** Split an array body into its top level `{ ... }` objects. */
function objects(body: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < body.length; i += 1) {
    if (body[i] === '{') {
      if (depth === 0) start = i;
      depth += 1;
    }
    if (body[i] === '}') {
      depth -= 1;
      if (depth === 0) out.push(body.slice(start, i + 1));
    }
  }
  return out;
}

const withCrumbs = pages(root)
  .map((file) => ({ file, arrays: crumbArrays(readFileSync(file, 'utf8')) }))
  .filter((p) => p.arrays.length > 0);

describe('admin pages with crumbs', () => {
  it('finds the admin pages', () => {
    expect(withCrumbs.length).toBeGreaterThan(15);
  });

  it('every admin page with a PageHeader starts its crumbs at Admin', () => {
    const bad = withCrumbs.filter((p) =>
      p.arrays.some((a) => !/^\s*\{\s*label:\s*'Admin',\s*href:\s*'\/admin'\s*\}/.test(a)),
    );
    expect(bad.map((p) => p.file)).toEqual([]);
  });

  it('the last crumb never has a link', () => {
    const bad = withCrumbs.filter((p) =>
      p.arrays.some((a) => {
        const list = objects(a);
        return /href\s*:/.test(list[list.length - 1] ?? '');
      }),
    );
    expect(bad.map((p) => p.file)).toEqual([]);
  });

  it('intermediate crumbs all have an href', () => {
    const bad = withCrumbs.filter((p) =>
      p.arrays.some((a) => objects(a).slice(0, -1).some((o) => !/href\s*:/.test(o))),
    );
    expect(bad.map((p) => p.file)).toEqual([]);
  });
});
