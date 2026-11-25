import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { loadLibrary } from '@ad/help/node';
import { bestScreenMatch } from '@ad/help';
import { describe, expect, it } from 'vitest';
import { NAV_ITEMS } from '@/components/admin/nav';
import { ADMIN_ACTIONS, requiredRole } from './can';

/**
 * Coverage tests (M50-S17). Every admin screen and menu item needs an article, or an entry in
 * content/help/coverage-gaps.json while a content lane is still writing it. The gap list may only shrink: a screen
 * that is covered must be removed from it, and a new screen must be covered or listed on purpose.
 */
const repo = resolve(import.meta.dirname, '../../../../..');
const adminApp = join(repo, 'apps/web/src/app/admin');
const lib = loadLibrary(join(repo, 'content/help'));
const gaps = JSON.parse(readFileSync(join(repo, 'content/help/coverage-gaps.json'), 'utf8')) as {
  routes: string[];
  nav: string[];
};

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

/** Routes that are not screens a person is taught: the help centre itself. */
const isHelp = (route: string) => route === '/admin/help' || route.startsWith('/admin/help/');
const routes = [...new Set(pageRoutes(adminApp))].filter((r) => !isHelp(r)).sort();
const patterns = Object.keys(lib.screenMap());
const covered = (route: string) => bestScreenMatch(patterns, route) === route;

describe('route coverage', () => {
  it('finds the admin routes', () => {
    expect(routes.length).toBeGreaterThan(35);
    expect(routes).toContain('/admin/videos/[id]');
  });

  it('every admin route has an article or is on the gap list', () => {
    const missing = routes.filter((r) => !covered(r) && !gaps.routes.includes(r));
    expect(
      missing,
      `Add an article with screens: ["<route>"], or list the route in content/help/coverage-gaps.json`,
    ).toEqual([]);
  });

  it('the gap list holds only routes that exist and are still uncovered', () => {
    expect(gaps.routes.filter((r) => !routes.includes(r))).toEqual([]);
    expect(
      gaps.routes.filter((r) => covered(r)),
      'These routes are covered now. Remove them from the gap list',
    ).toEqual([]);
  });

  it('every screens entry of an article is a real route', () => {
    const bad = patterns.filter((p) => !routes.includes(p));
    expect(bad).toEqual([]);
  });
});

describe('menu coverage', () => {
  const covers = (href: string) => lib.forScreen(href).length > 0;
  it('every side menu item has an article or is on the gap list', () => {
    const missing = NAV_ITEMS.filter((i) => !covers(i.href) && !gaps.nav.includes(i.href)).map(
      (i) => i.href,
    );
    expect(missing).toEqual([]);
  });
  it('the menu gap list holds only menu items that are still uncovered', () => {
    const hrefs = NAV_ITEMS.map((i) => i.href);
    expect(gaps.nav.filter((h) => !hrefs.includes(h))).toEqual([]);
    expect(gaps.nav.filter((h) => covers(h))).toEqual([]);
  });
});

describe('permission coverage', () => {
  it('every action an article names exists in the permission table', () => {
    const unknown = lib.articles.flatMap((a) =>
      a.meta.actions
        .filter((x) => !(ADMIN_ACTIONS as string[]).includes(x))
        .map((x) => `${a.meta.id}: ${x}`),
    );
    expect(unknown).toEqual([]);
  });

  it('the role in front matter is the lowest role among its actions', () => {
    const rank = { editor: 1, admin: 2, super_admin: 3 } as const;
    const wrong = lib.articles
      .filter((a) => a.meta.actions.length > 0)
      .filter((a) => {
        const lowest = Math.min(
          ...a.meta.actions.map((x) => rank[requiredRole(x as (typeof ADMIN_ACTIONS)[number])]),
        );
        return rank[a.meta.role] !== lowest;
      })
      .map((a) => a.meta.id);
    expect(
      wrong,
      'role must equal the lowest role among actions. Use roleNote for the higher parts',
    ).toEqual([]);
  });
});
