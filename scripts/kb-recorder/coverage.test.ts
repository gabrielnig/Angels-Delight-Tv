import { describe, expect, it } from 'vitest';
import type { Episode } from './episode';
import { episodeCoverage, evaluateCoverage, type Inventory } from './coverage';

const run = async () => {};
const ep = (id: string, extra: Partial<Episode> = {}): Episode => ({
  id,
  title: id,
  role: 'editor',
  steps: [{ caption: 'Click.', run }],
  ...extra,
});

const inventory: Inventory = {
  routes: ['/admin', '/admin/videos', '/admin/videos/[id]'],
  nav: ['Dashboard', 'Videos'],
  actions: ['video.upload', 'video.delete'],
  settings: ['site.name', 'site.tagline'],
  statuses: ['video:ready', 'publish:draft'],
};

describe('episodeCoverage', () => {
  it('collects what the episodes declare', () => {
    const c = episodeCoverage([
      ep('A', {
        screens: ['/admin/videos'],
        actions: ['video.upload'],
        covers: { nav: ['Videos'], settings: ['site.name'], statuses: ['video:ready'] },
      }),
      ep('B', { screens: ['/admin'] }),
    ]);
    expect([...c.routes].sort()).toEqual(['/admin', '/admin/videos']);
    expect([...c.nav]).toEqual(['Videos']);
    expect([...c.actions]).toEqual(['video.upload']);
    expect([...c.settings]).toEqual(['site.name']);
    expect([...c.statuses]).toEqual(['video:ready']);
  });
});

describe('evaluateCoverage', () => {
  const gaps: Inventory = { routes: [], nav: [], actions: [], settings: [], statuses: [] };
  const full = [
    ep('A', {
      screens: ['/admin', '/admin/videos', '/admin/videos/[id]'],
      actions: ['video.upload', 'video.delete'],
      covers: {
        nav: ['Dashboard', 'Videos'],
        settings: ['site.name', 'site.tagline'],
        statuses: ['video:ready', 'publish:draft'],
      },
    }),
  ];

  it('is clean when everything is covered and nothing is on the gap list', () => {
    expect(evaluateCoverage(inventory, full, gaps)).toEqual([]);
  });

  it('lists what has no episode and no gap entry, grouped and named', () => {
    const problems = evaluateCoverage(inventory, [ep('A', { screens: ['/admin'] })], gaps);
    const text = problems.join('\n');
    expect(text).toMatch(/2 admin routes? .*\/admin\/videos, \/admin\/videos\/\[id\]/);
    expect(text).toMatch(/2 menu items?.*Dashboard, Videos/);
    expect(text).toMatch(/2 permission actions?.*video\.upload, video\.delete/);
    expect(text).toMatch(/2 settings?.*site\.name, site\.tagline/);
    expect(text).toMatch(/2 statuses?.*video:ready, publish:draft/);
  });

  it('accepts a gap entry for something still uncovered', () => {
    const g: Inventory = { ...gaps, routes: ['/admin/videos', '/admin/videos/[id]'] };
    expect(evaluateCoverage(inventory, [ep('A', { screens: ['/admin'] })], g).join()).not.toMatch(
      /admin routes/,
    );
  });

  it('fails on a gap entry that is covered now, so the list can only shrink', () => {
    const g: Inventory = { ...gaps, routes: ['/admin'] };
    expect(evaluateCoverage(inventory, full, g).join('\n')).toMatch(/covered now.*\/admin/s);
  });

  it('fails on a gap entry for something that does not exist', () => {
    const g: Inventory = { ...gaps, actions: ['video.nope'] };
    expect(evaluateCoverage(inventory, full, g).join('\n')).toMatch(/does not exist.*video\.nope/s);
  });

  it('fails when an episode names something that does not exist', () => {
    const bad = [
      ep('A', {
        screens: ['/admin/nope'],
        actions: ['video.nope'],
        covers: { nav: ['Nope'], settings: ['x.y'], statuses: ['video:odd'] },
      }),
    ];
    const text = evaluateCoverage(inventory, bad, gaps).join('\n');
    expect(text).toMatch(/Episode A.*\/admin\/nope/);
    expect(text).toMatch(/Episode A.*video\.nope/);
    expect(text).toMatch(/Episode A.*Nope/);
    expect(text).toMatch(/Episode A.*x\.y/);
    expect(text).toMatch(/Episode A.*video:odd/);
  });
});
