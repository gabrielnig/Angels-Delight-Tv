import { describe, expect, it } from 'vitest';
import {
  addRow,
  addTitle,
  defaultHome,
  MAX_ROWS,
  moveRow,
  reorderRows,
  renameRow,
  ROW_TYPE_LABELS,
  setKidsVisible,
  setMinItems,
  setViewAll,
  validateConfig,
  moveTitle,
  removeRow,
  resolvePreview,
  setHero,
  toggleRow,
} from './home-rules';
import { getStore } from './store';

const ids = () => {
  let n = 0;
  return () => `r${++n}`;
};

describe('home rules', () => {
  it('moves rows and stops at the ends', () => {
    const c = defaultHome();
    expect(moveRow(c, 'row_newest', -1).rows[0]!.id).toBe('row_newest');
    expect(moveRow(c, 'row_continue', -1)).toBe(c);
  });
  it('toggles visibility', () => {
    expect(toggleRow(defaultHome(), 'row_smart').rows[2]!.visible).toBe(false);
  });
  it('adds a named row and enforces the limit', () => {
    let c = defaultHome();
    const r = addRow(c, 'manual', ' Start here ', null, ids());
    expect(r.ok && r.config.rows.at(-1)!.name).toBe('Start here');
    expect(addRow(c, 'manual', '', null, ids()).ok).toBe(false);
    expect(addRow(c, 'category', 'Sci', null, ids()).ok).toBe(false);
    for (let i = c.rows.length; i < MAX_ROWS; i++) {
      const next = addRow(c, 'manual', `Row ${i}`, null, ids());
      if (next.ok) c = next.config;
    }
    expect(addRow(c, 'manual', 'One more', null, ids()).ok).toBe(false);
  });
  it('will not remove a built in row', () => {
    expect(removeRow(defaultHome(), 'row_continue').ok).toBe(false);
  });
  it('adds, rejects duplicate and reorders titles', () => {
    const c = addRow(defaultHome(), 'manual', 'Picks', null, () => 'm1');
    if (!c.ok) throw new Error();
    let cfg = c.config;
    for (const v of ['a', 'b']) {
      const r = addTitle(cfg, 'm1', v);
      if (r.ok) cfg = r.config;
    }
    expect(addTitle(cfg, 'm1', 'a').ok).toBe(false);
    expect(moveTitle(cfg, 'm1', 'b', -1).rows.find((r) => r.id === 'm1')!.videoIds).toEqual([
      'b',
      'a',
    ]);
  });
  it('limits hero slots to five', () => {
    expect(setHero(defaultHome(), ['1', '2', '3', '4', '5', '6']).ok).toBe(false);
    expect(setHero(defaultHome(), ['1', '1']).ok).toBe(true);
  });
  it('previews: skips unpublished titles and filters kids', () => {
    const s = structuredClone(getStore());
    const pub = s.videos.filter((v) => v.publishState === 'published');
    const draft = s.videos.find((v) => v.publishState !== 'published' && v.deletedAt === null)!;
    const c = addRow(defaultHome(), 'manual', 'Picks', null, () => 'm1');
    if (!c.ok) throw new Error();
    let cfg = c.config;
    for (const v of [pub[0]!.id, draft.id]) {
      const r = addTitle(cfg, 'm1', v);
      if (r.ok) cfg = r.config;
    }
    const preview = resolvePreview(cfg, s.videos, s.series, false);
    const row = preview.rows.find((r) => r.id === 'm1')!;
    expect(row.items.map((v) => v.id)).toEqual([pub[0]!.id]);
    expect(row.skipped.map((v) => v.id)).toEqual([draft.id]);
    const kids = resolvePreview(cfg, s.videos, s.series, true).rows.find((r) => r.id === 'm1')!;
    expect(kids.items.every((v) => v.suitability === 'kids' || v.suitability === 'everyone')).toBe(
      true,
    );
  });
  it('previews the five newest live titles when no hero titles are chosen', () => {
    const s = structuredClone(getStore());
    const preview = resolvePreview(defaultHome(), s.videos, s.series, false);
    const newest = s.videos
      .filter((v) => v.deletedAt === null && v.publishState === 'published')
      .sort((a, b) => (b.publishedAt ?? '').localeCompare(a.publishedAt ?? ''))
      .slice(0, 5)
      .map((v) => v.id);
    expect(preview.heroFallback).toBe(true);
    expect(preview.hero.map((v) => v.id)).toEqual(newest);
  });
  it('previews the same fallback when every chosen hero title is unpublished', () => {
    const s = structuredClone(getStore());
    const draft = s.videos.find((v) => v.publishState !== 'published' && v.deletedAt === null)!;
    const set = setHero(defaultHome(), [draft.id]);
    if (!set.ok) throw new Error();
    const preview = resolvePreview(set.config, s.videos, s.series, false);
    expect(preview.heroFallback).toBe(true);
    expect(preview.skippedHero.map((v) => v.id)).toEqual([draft.id]);
    expect(preview.hero.length).toBeGreaterThan(0);
  });
  it('keeps chosen hero titles and does not flag a fallback', () => {
    const s = structuredClone(getStore());
    const pub = s.videos.filter((v) => v.publishState === 'published' && v.deletedAt === null);
    const set = setHero(defaultHome(), [pub[1]!.id]);
    if (!set.ok) throw new Error();
    const preview = resolvePreview(set.config, s.videos, s.series, false);
    expect(preview.heroFallback).toBe(false);
    expect(preview.hero.map((v) => v.id)).toEqual([pub[1]!.id]);
  });

  it('sets View all, keeping a custom link only when valid', () => {
    const c = defaultHome();
    const ok = setViewAll(c, 'row_newest', 'custom', 'https://example.org/p');
    expect(ok.ok && ok.config.rows.find((r) => r.id === 'row_newest')).toMatchObject({
      viewAllMode: 'custom',
      viewAllUrl: 'https://example.org/p',
    });
    const bad = setViewAll(c, 'row_newest', 'custom', '//x.com');
    expect(bad).toEqual({ ok: false, error: 'Use a path on this site or an https link' });
    const none = setViewAll(c, 'row_newest', 'none', null);
    expect(none.ok && none.config.rows.find((r) => r.id === 'row_newest')?.viewAllMode).toBe('none');
  });
  it('sets the minimum between 1 and 20', () => {
    const c = defaultHome();
    expect(setMinItems(c, 'row_smart', 0).ok).toBe(false);
    expect(setMinItems(c, 'row_smart', 21).ok).toBe(false);
    const ok = setMinItems(c, 'row_smart', 6);
    expect(ok.ok && ok.config.rows.find((r) => r.id === 'row_smart')?.minItems).toBe(6);
  });
  it('switches kids visibility', () => {
    const c = setKidsVisible(defaultHome(), 'row_newest', false);
    expect(c.rows.find((r) => r.id === 'row_newest')?.kidsVisible).toBe(false);
  });
  it('gives a new manual list a slug, unique, kept on rename', () => {
    const a = addRow(defaultHome(), 'manual', 'Farm tips', null, () => 'm1');
    if (!a.ok) throw new Error();
    const b = addRow(a.config, 'manual', 'Farm tips', null, () => 'm2');
    if (!b.ok) throw new Error();
    expect(b.config.rows.filter((r) => r.type === 'manual').map((r) => r.slug)).toEqual(['farm-tips', 'farm-tips-2']);
    const renamed = renameRow(b.config, 'm1', 'Better name');
    expect(renamed.ok && renamed.config.rows.find((r) => r.id === 'm1')?.slug).toBe('farm-tips');
  });
  it('adds the two automatic types with their default minimums', () => {
    const e = addRow(defaultHome(), 'each_category', 'Browse by subject', null, () => 'e1');
    const s = e.ok ? addRow(e.config, 'all_series', 'Series', null, () => 's1') : e;
    if (!s.ok) throw new Error();
    expect(s.config.rows.slice(-2).map((r) => [r.type, r.minItems])).toEqual([
      ['each_category', 4],
      ['all_series', 2],
    ]);
  });
  it('reorders a row to a position and says where it went', () => {
    const c = defaultHome();
    const moved = reorderRows(c, 'row_smart', 0);
    expect(moved.rows[0]!.id).toBe('row_smart');
    expect(reorderRows(c, 'row_smart', 99).rows.at(-1)!.id).toBe('row_smart');
    expect(reorderRows(c, 'missing', 0)).toBe(c);
  });
  it('uses the story words for names and the limit', () => {
    expect(addRow(defaultHome(), 'manual', ' ', null, () => 'x')).toEqual({
      ok: false,
      error: 'Give the section a name',
    });
    expect(validateConfig({ heroIds: [], rows: [{ ...defaultHome().rows[0]!, name: ' ' }] })).toBe(
      'Give the section a name',
    );
  });
  it('labels the new types', () => {
    expect(ROW_TYPE_LABELS.smart).toBe('Trending');
    expect(ROW_TYPE_LABELS.each_category).toBe('Each category (automatic)');
    expect(ROW_TYPE_LABELS.all_series).toBe('All series (automatic)');
    expect(ROW_TYPE_LABELS.continue_watching).toBe('Continue learning');
  });
});
