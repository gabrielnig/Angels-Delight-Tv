import type { Episode } from './episode';

/** What the product has: every admin route, menu item, permission action, setting and status (plan section 12.3). */
export interface Inventory {
  routes: string[];
  nav: string[];
  actions: string[];
  settings: string[];
  /** `video:<value>` for the pipeline statuses, `publish:<value>` and `caption:<value>`. */
  statuses: string[];
}

export type Kind = keyof Inventory;

export interface Covered {
  routes: Set<string>;
  nav: Set<string>;
  actions: Set<string>;
  settings: Set<string>;
  statuses: Set<string>;
}

/** What the episodes declare they teach: `screens`, `actions` and `covers`. */
export function episodeCoverage(episodes: Episode[]): Covered {
  const c: Covered = {
    routes: new Set(),
    nav: new Set(),
    actions: new Set(),
    settings: new Set(),
    statuses: new Set(),
  };
  for (const e of episodes) {
    for (const r of e.screens ?? []) c.routes.add(r);
    for (const a of e.actions ?? []) c.actions.add(a);
    for (const n of e.covers?.nav ?? []) c.nav.add(n);
    for (const s of e.covers?.settings ?? []) c.settings.add(s);
    for (const s of e.covers?.statuses ?? []) c.statuses.add(s);
  }
  return c;
}

const LABEL: Record<Kind, [string, string]> = {
  routes: ['admin route', 'admin routes'],
  nav: ['menu item', 'menu items'],
  actions: ['permission action', 'permission actions'],
  settings: ['setting', 'settings'],
  statuses: ['status', 'statuses'],
};

const noun = (kind: Kind, n: number) => (n === 1 ? LABEL[kind][0] : LABEL[kind][1]);
const KINDS: Kind[] = ['routes', 'nav', 'actions', 'settings', 'statuses'];

/**
 * Compares the inventory with the episodes and the gap list. Returns plain problems, empty when clean:
 * 1. something with no episode and no gap entry, 2. a gap entry that is covered now (the list can only shrink),
 * 3. a gap entry for something that does not exist, 4. an episode that names something that does not exist.
 */
export function evaluateCoverage(
  inventory: Inventory,
  episodes: Episode[],
  gaps: Inventory,
): string[] {
  const covered = episodeCoverage(episodes);
  const problems: string[] = [];
  for (const kind of KINDS) {
    const have = new Set(inventory[kind]);
    const missing = inventory[kind].filter((x) => !covered[kind].has(x) && !gaps[kind].includes(x));
    if (missing.length) {
      problems.push(
        `${missing.length} ${noun(kind, missing.length)} with no episode: ${missing.join(', ')}. Write an episode that lists it, or add it to scripts/kb-recorder/coverage-gaps.json on purpose.`,
      );
    }
    const stale = gaps[kind].filter((x) => covered[kind].has(x));
    if (stale.length) {
      problems.push(
        `${stale.length} ${noun(kind, stale.length)} covered now, remove from the gap list: ${stale.join(', ')}`,
      );
    }
    const ghosts = gaps[kind].filter((x) => !have.has(x));
    if (ghosts.length) {
      problems.push(
        `${ghosts.length} gap entr${ghosts.length === 1 ? 'y' : 'ies'} for ${LABEL[kind][1]} that does not exist: ${ghosts.join(', ')}`,
      );
    }
  }
  for (const e of episodes) {
    const own = episodeCoverage([e]);
    for (const kind of KINDS) {
      const unknown = [...own[kind]].filter((x) => !inventory[kind].includes(x));
      if (unknown.length) {
        problems.push(
          `Episode ${e.id} names ${LABEL[kind][1]} that do not exist: ${unknown.join(', ')}`,
        );
      }
    }
  }
  return problems;
}
