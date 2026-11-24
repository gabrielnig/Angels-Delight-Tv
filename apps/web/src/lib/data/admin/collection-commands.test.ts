import { describe, expect, it } from 'vitest';
import {
  createCategory,
  createSeries,
  deleteCategory,
  deleteSeries,
  moveCategory,
  renameCategory,
  setCategoryHidden,
  updateSeries,
} from './collection-commands';
import { getStore } from './store';

const fresh = () => structuredClone(getStore());

describe('categories', () => {
  it('creates at the end with a trimmed name', () => {
    const s = fresh();
    const r = createCategory(s, '  Languages ');
    expect(r.ok).toBe(true);
    expect(s.categories.at(-1)).toMatchObject({
      name: 'Languages',
      hidden: false,
      position: s.categories.length - 1,
    });
  });
  it('rejects empty and duplicate names', () => {
    const s = fresh();
    expect(createCategory(s, '   ').ok).toBe(false);
    expect(createCategory(s, 'science').ok).toBe(false);
    expect(renameCategory(s, 'cat_maths', 'Science').ok).toBe(false);
  });
  it('moves and keeps positions contiguous', () => {
    const s = fresh();
    moveCategory(s, 'cat_maths', -1);
    expect(
      s.categories
        .sort((a, b) => a.position - b.position)
        .map((c) => c.id)
        .slice(0, 3),
    ).toEqual(['cat_life', 'cat_maths', 'cat_science']);
    expect(s.categories.map((c) => c.position).sort()).toEqual([0, 1, 2, 3, 4]);
  });
  it('hides', () => {
    const s = fresh();
    setCategoryHidden(s, 'cat_geo', true);
    expect(s.categories.find((c) => c.id === 'cat_geo')!.hidden).toBe(true);
  });
  it('refuses to delete a category that still has videos', () => {
    const s = fresh();
    const used = s.videos.find((v) => v.categoryIds.length)!.categoryIds[0]!;
    const r = deleteCategory(s, used);
    expect(r.ok).toBe(false);
  });
  it('deletes an unused category', () => {
    const s = fresh();
    s.videos.forEach((v) => (v.categoryIds = v.categoryIds.filter((c) => c !== 'cat_geo')));
    expect(deleteCategory(s, 'cat_geo').ok).toBe(true);
    expect(s.categories.some((c) => c.id === 'cat_geo')).toBe(false);
  });
});

describe('series', () => {
  it('creates a draft series', () => {
    const s = fresh();
    const r = createSeries(s, { title: 'New show', description: '' });
    expect(r.ok).toBe(true);
    expect(s.series.at(-1)).toMatchObject({ title: 'New show', published: false });
  });
  it('needs a title', () => {
    expect(createSeries(fresh(), { title: ' ', description: '' }).ok).toBe(false);
  });
  it('refuses to publish a series with no published episode', () => {
    const s = fresh();
    const r = updateSeries(s, 'ser_life', { published: true });
    expect(r.ok).toBe(false);
  });
  it('deleting a series unlinks its videos', () => {
    const s = fresh();
    expect(deleteSeries(s, 'ser_maths').ok).toBe(true);
    expect(s.videos.every((v) => v.seriesId !== 'ser_maths')).toBe(true);
  });
});

describe('series maturity rating (M44-S13)', () => {
  const withEpisodes = () => {
    const s = fresh();
    const series = s.series[0]!;
    const episodes = s.videos.filter((v) => v.seriesId === series.id && v.deletedAt === null);
    return { s, series, episodes };
  };

  it('sets the series rank and leaves the episodes alone', () => {
    const { s, series, episodes } = withEpisodes();
    const before = episodes.map((v) => v.maturityRank);
    expect(updateSeries(s, series.id, { maturityRank: 2 }).ok).toBe(true);
    expect(series.maturityRank).toBe(2);
    expect(episodes.map((v) => v.maturityRank)).toEqual(before);
  });

  it('with applyToEpisodes gives every episode the same rank', () => {
    const { s, series, episodes } = withEpisodes();
    expect(episodes.length).toBeGreaterThan(0);
    expect(updateSeries(s, series.id, { maturityRank: 3, applyToEpisodes: true }).ok).toBe(true);
    expect(episodes.every((v) => v.maturityRank === 3)).toBe(true);
  });

  it('refuses a rank outside 0 to 4 and changes nothing', () => {
    const { s, series } = withEpisodes();
    const before = series.maturityRank;
    const result = updateSeries(s, series.id, { maturityRank: 9 });
    expect(result).toEqual({ ok: false, error: 'Choose one of the five ratings.' });
    expect(series.maturityRank).toBe(before);
  });
});
