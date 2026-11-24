import { describe, expect, it } from 'vitest';
import { hashText } from '@ad/i18n';
import { buildLanguageRows, buildWorkspaceRows, filterWorkspaceRows } from './admin-data';

const english = {
  'nav.home': 'Home',
  'nav.browse': 'Browse {name}',
  'player.count': { one: '{count} video', other: '{count} videos' },
} as never;
const row = (key: string, status: 'draft' | 'in_review' | 'approved', text: unknown, en: unknown = (english as Record<string, unknown>)[key]) => ({
  key, status, text: text as never, sourceHash: hashText(en as never), updatedAt: new Date(0),
});

describe('buildLanguageRows', () => {
  const rows = (enabled: string[], min = 80) =>
    buildLanguageRows({
      english,
      enabled,
      min,
      rowsByLocale: { yo: [row('nav.home', 'approved', 'Ilé')], ig: [], ha: [], pcm: [] },
      baselines: {},
    });
  it('lists one row per translatable locale with state, percent, missing and stale', () => {
    const r = rows(['en', 'yo']);
    expect(r.map((x) => x.code)).toEqual(['yo', 'ig', 'ha', 'pcm']);
    const yo = r[0]!;
    expect(yo.state).toBe('live');
    expect(yo.percent).toBe(33);
    expect(yo.missing).toBe(2);
    expect(r[1]!.state).toBe('off');
  });
  it('a locale with text but not live is Draft', () => {
    const r = rows(['en']);
    expect(r[0]!.state).toBe('draft');
  });
  it('Publish is disabled below the threshold with the reason', () => {
    const yo = rows(['en'])[0]!;
    expect(yo.canPublish).toBe(false);
    expect(yo.reason).toMatch(/33 percent.*80 percent/);
    expect(rows(['en'], 30)[0]!.canPublish).toBe(true);
  });
});

describe('workspace rows', () => {
  const all = () =>
    buildWorkspaceRows({
      locale: 'ha',
      english,
      baseline: {},
      rows: [row('nav.home', 'in_review', 'Gida'), row('player.count', 'approved', { one: 'a', other: 'b' }, 'Old')],
    });
  it('marks missing, stale, in review and approved', () => {
    const rows = all();
    const by = Object.fromEntries(rows.map((r) => [r.key, r.status]));
    expect(by).toEqual({ 'nav.home': 'in_review', 'nav.browse': 'missing', 'player.count': 'stale' });
  });
  it('reads placeholders as chips and plural categories for the locale', () => {
    const rows = all();
    expect(rows.find((r) => r.key === 'nav.browse')!.placeholders).toEqual(['name']);
    expect(rows.find((r) => r.key === 'player.count')!.categories).toEqual(['one', 'other']);
    const yo = buildWorkspaceRows({ locale: 'yo', english, baseline: {}, rows: [] });
    expect(yo.find((r) => r.key === 'player.count')!.categories).toEqual(['other']);
  });
  it('filters by status, area and search', () => {
    const rows = all();
    expect(filterWorkspaceRows(rows, { status: 'missing' }).map((r) => r.key)).toEqual(['nav.browse']);
    expect(filterWorkspaceRows(rows, { area: 'player' }).map((r) => r.key)).toEqual(['player.count']);
    expect(filterWorkspaceRows(rows, { q: 'browse' }).map((r) => r.key)).toEqual(['nav.browse']);
    expect(filterWorkspaceRows(rows, { q: 'gida' }).map((r) => r.key)).toEqual(['nav.home']);
    expect(filterWorkspaceRows(rows, {})).toHaveLength(3);
  });
});
