import { describe, expect, it } from 'vitest';
import {
  RESERVED_LIST_SLUGS,
  VIEW_ALL_URL_MESSAGE,
  describeViewAll,
  resolveViewAll,
  viewAllUrlProblem,
} from './view-all';

const auto = { mode: 'auto' as const, url: null };

describe('viewAllUrlProblem (M41-S08 AC2)', () => {
  it.each(['/browse/farming', '/', '/my-list', 'https://example.org/page'])('accepts %s', (url) => {
    expect(viewAllUrlProblem(url)).toBeNull();
  });
  it.each(['', '//x.com', 'http://example.org', 'javascript:alert(1)', '/a b', '/a\\b', 'https://', 'ftp://x', `/${'a'.repeat(300)}`])(
    'refuses %j with the plain message',
    (url) => {
      expect(viewAllUrlProblem(url)).toBe(VIEW_ALL_URL_MESSAGE);
    },
  );
  it('has the words from the story', () => {
    expect(VIEW_ALL_URL_MESSAGE).toBe('Use a path on this site or an https link');
  });
});

describe('resolveViewAll automatic targets (M41-S08 AC3)', () => {
  it('New, Trending, All series and My List', () => {
    expect(resolveViewAll({ kind: 'recently_added', ...auto })).toEqual({ href: '/browse/new', external: false });
    expect(resolveViewAll({ kind: 'popular', ...auto })?.href).toBe('/browse/trending');
    expect(resolveViewAll({ kind: 'all_series', ...auto })?.href).toBe('/browse/series');
    expect(resolveViewAll({ kind: 'my_list', ...auto })?.href).toBe('/my-list');
  });
  it('a category, a series section and a manual list', () => {
    expect(resolveViewAll({ kind: 'category', categorySlug: 'farming', ...auto })?.href).toBe('/browse/farming');
    expect(resolveViewAll({ kind: 'curated', seriesSlug: 'nile', ...auto })?.href).toBe('/series/nile');
    expect(resolveViewAll({ kind: 'curated', rowSlug: 'start-here', ...auto })?.href).toBe('/browse/row/start-here');
  });
  it('has no target for Continue learning, hero, a manual list with no slug and a generated parent', () => {
    expect(resolveViewAll({ kind: 'continue_watching', ...auto })).toBeNull();
    expect(resolveViewAll({ kind: 'hero', ...auto })).toBeNull();
    expect(resolveViewAll({ kind: 'curated', ...auto })).toBeNull();
    expect(resolveViewAll({ kind: 'each_category', ...auto })).toBeNull();
  });
});

describe('resolveViewAll custom and none', () => {
  it('uses a custom path or https link and marks https as external', () => {
    expect(resolveViewAll({ kind: 'curated', mode: 'custom', url: '/browse/farming' })).toEqual({
      href: '/browse/farming',
      external: false,
    });
    expect(resolveViewAll({ kind: 'curated', mode: 'custom', url: 'https://example.org/p' })).toEqual({
      href: 'https://example.org/p',
      external: true,
    });
  });
  it('drops an invalid custom value and hides on none', () => {
    expect(resolveViewAll({ kind: 'curated', mode: 'custom', url: '//x.com' })).toBeNull();
    expect(resolveViewAll({ kind: 'recently_added', mode: 'none', url: null })).toBeNull();
  });
});

describe('describeViewAll words for the admin', () => {
  it('names the automatic target', () => {
    expect(describeViewAll({ kind: 'recently_added', ...auto })).toBe('Opens All new videos (/browse/new)');
    expect(describeViewAll({ kind: 'popular', ...auto })).toBe('Opens Trending (/browse/trending)');
    expect(describeViewAll({ kind: 'all_series', ...auto })).toBe('Opens All series (/browse/series)');
    expect(describeViewAll({ kind: 'category', categorySlug: 'farming', ...auto })).toBe('Opens the Farming list (/browse/farming)');
    expect(describeViewAll({ kind: 'continue_watching', ...auto })).toBe('This section has no View all link');
    expect(describeViewAll({ kind: 'recently_added', mode: 'none', url: null })).toBe('No link');
  });
});

it('reserves the four list page words', () => {
  expect([...RESERVED_LIST_SLUGS].sort()).toEqual(['new', 'row', 'series', 'trending']);
});
