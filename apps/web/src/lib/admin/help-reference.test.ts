import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { NAV_ITEMS } from '@/components/admin/nav';
import { ADMIN_ACTIONS } from './can';
import {
  ACTION_NAMES,
  GENERATED,
  SCREEN_PURPOSES,
  STATUS_MEANINGS,
  renderScreens,
  statusKeys,
} from './help-reference';

/**
 * The generated reference guides (lane C7). The code is the source: a new permission action, admin screen or status
 * word with no plain words fails here, and each article must hold exactly what the generator writes. Rewrite them with
 *   KB_WRITE_REFERENCE=1 pnpm vitest run apps/web/src/lib/admin/help-reference.test.ts
 */
const repo = resolve(import.meta.dirname, '../../../../..');
const reference = join(repo, 'content/help/en/reference');
const write = process.env.KB_WRITE_REFERENCE === '1';
const DASH = new RegExp(`[${String.fromCharCode(0x2013)}${String.fromCharCode(0x2014)}]`);

function pageRoutes(dir: string, base = '/admin'): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      const segment = /^\(.*\)$/.test(name) ? '' : `/${name}`;
      return pageRoutes(full, `${base}${segment}`);
    }
    return name === 'page.tsx' ? [base] : [];
  });
}
const isHelp = (r: string) => r === '/admin/help' || r.startsWith('/admin/help/');
const routes = [...new Set(pageRoutes(join(repo, 'apps/web/src/app/admin')))]
  .filter((r) => !isHelp(r))
  .sort();
const navRoutes = NAV_ITEMS.map((n) => n.href);
const ordered = [...navRoutes.filter((r) => routes.includes(r)), ...routes.filter((r) => !navRoutes.includes(r))];

const fileOf = (id: string) => {
  const name = readdirSync(reference).find((n) => n.startsWith(`${id}-`));
  if (!name) throw new Error(`No article file for ${id} in ${reference}`);
  return join(reference, name);
};
const BLOCK = (id: string) => new RegExp(`(<!-- kb:generated ${id} -->\\n)([\\s\\S]*?)(\\n<!-- /kb:generated -->)`);

function checkArticle(id: string, body: string) {
  const file = fileOf(id);
  const text = readFileSync(file, 'utf8');
  const m = BLOCK(id).exec(text);
  expect(m, `${id} has no kb:generated block`).not.toBeNull();
  if (write) writeFileSync(file, text.replace(BLOCK(id), (_a, a, _b, c) => `${a}${body}${c}`));
  else expect(m![2], `${id} is out of date. Run with KB_WRITE_REFERENCE=1`).toBe(body);
}

describe('generated reference guides', () => {
  it('names every permission action in plain words', () => {
    expect(Object.keys(ACTION_NAMES).sort()).toEqual([...ADMIN_ACTIONS].sort());
    for (const text of Object.values(ACTION_NAMES)) expect(text).not.toMatch(DASH);
  });

  it('describes every admin screen, and nothing that is gone', () => {
    expect(Object.keys(SCREEN_PURPOSES).sort()).toEqual(routes);
  });

  it('explains every status word the screens can show, and nothing that is gone', () => {
    expect(Object.keys(STATUS_MEANINGS).sort()).toEqual([...statusKeys()].sort());
  });

  it('R02 holds the permission table', () => checkArticle('R02', GENERATED.R02()));
  it('R03 holds the screen map', () => checkArticle('R03', renderScreens(ordered)));
  it('R05 holds the player keys', () => checkArticle('R05', GENERATED.R05()));
  it('R06 holds the status words', () => checkArticle('R06', GENERATED.R06()));
});
