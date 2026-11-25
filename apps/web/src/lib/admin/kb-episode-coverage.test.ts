import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { CAPTION_STATUSES, PUBLISH_STATES, VIDEO_STATUSES } from '@ad/shared';
import { SETTING_KEYS } from '@ad/theme/client';
import { describe, expect, it } from 'vitest';
import { NAV_ITEMS } from '@/components/admin/nav';
import { evaluateCoverage, type Inventory } from '../../../../../scripts/kb-recorder/coverage';
import { loadAllEpisodes } from '../../../../../scripts/kb-recorder/registry';
import { ADMIN_ACTIONS } from './can';

/**
 * Episode coverage (M50-S17, plan section 12.3): every admin route, menu item, permission action, setting and status
 * is taught by at least one episode, or is on `scripts/kb-recorder/coverage-gaps.json` while a content lane is still
 * writing it. The list can only shrink. To (re)write it from the current state:
 *   KB_WRITE_GAPS=1 pnpm vitest run apps/web/src/lib/admin/kb-episode-coverage.test.ts
 * Content lanes empty it by adding episodes with `screens`, `actions` and `covers`.
 */
const repo = resolve(import.meta.dirname, '../../../../..');
const gapsFile = join(repo, 'scripts/kb-recorder/coverage-gaps.json');

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

/** The help centre teaches itself (articles S08), so its own pages are not screens to record. */
const isHelp = (route: string) => route === '/admin/help' || route.startsWith('/admin/help/');

const inventory: Inventory = {
  routes: [...new Set(pageRoutes(join(repo, 'apps/web/src/app/admin')))]
    .filter((r) => !isHelp(r))
    .sort(),
  nav: NAV_ITEMS.map((n) => n.label).filter((l) => l !== 'Help'),
  actions: [...ADMIN_ACTIONS].sort(),
  settings: [...SETTING_KEYS].sort(),
  statuses: [
    ...VIDEO_STATUSES.map((s) => `video:${s}`),
    ...PUBLISH_STATES.map((s) => `publish:${s}`),
    ...CAPTION_STATUSES.map((s) => `caption:${s}`),
  ],
};

describe('episode coverage', async () => {
  const episodes = await loadAllEpisodes();

  if (process.env.KB_WRITE_GAPS === '1') {
    const covered = (await import('../../../../../scripts/kb-recorder/coverage')).episodeCoverage(
      episodes,
    );
    const gaps = Object.fromEntries(
      (Object.keys(inventory) as Array<keyof Inventory>).map((k) => [
        k,
        inventory[k].filter((x) => !covered[k].has(x)),
      ]),
    );
    writeFileSync(gapsFile, JSON.stringify(gaps, null, 2) + '\n');
  }

  const gaps = JSON.parse(readFileSync(gapsFile, 'utf8')) as Inventory;

  it('finds the inventory', () => {
    expect(inventory.routes.length).toBeGreaterThan(35);
    expect(inventory.nav.length).toBeGreaterThan(15);
    expect(inventory.actions.length).toBeGreaterThan(40);
    expect(inventory.settings.length).toBeGreaterThan(50);
    expect(inventory.statuses).toContain('video:encoding');
  });

  it('every route, menu item, permission action, setting and status has an episode or a gap entry', () => {
    expect(evaluateCoverage(inventory, episodes, gaps)).toEqual([]);
  });
});
