import { describe, expect, it } from 'vitest';
import {
  addRow,
  addTitle,
  defaultHome,
  MAX_ROWS,
  moveRow,
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
});
