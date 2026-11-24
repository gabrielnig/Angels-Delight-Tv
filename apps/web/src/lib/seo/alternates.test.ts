import { describe, expect, it } from 'vitest';
import { canonicalPath, hreflangAlternates, listingRobots } from './alternates';

describe('canonicalPath', () => {
  it('drops tracking and sort params and keeps the path', () => {
    expect(canonicalPath('/title/rivers', { utm_source: 'wa', fbclid: 'x', sort: 'new' })).toBe('/title/rivers');
  });
  it('keeps params that change the content', () => {
    expect(canonicalPath('/browse', { category: 'science', utm_medium: 'x' })).toBe('/browse?category=science');
  });
  it('sorts kept params so one page has one address', () => {
    expect(canonicalPath('/browse', { b: '2', a: '1' })).toBe('/browse?a=1&b=2');
  });
});

describe('hreflangAlternates', () => {
  it('returns nothing with one locale', () => {
    expect(hreflangAlternates('/title/rivers', ['en'], 'https://x.test')).toBeUndefined();
  });
  it('lists every locale plus x-default when more than one is enabled', () => {
    expect(hreflangAlternates('/title/rivers', ['en', 'yo'], 'https://x.test')).toEqual({
      en: 'https://x.test/en/title/rivers',
      yo: 'https://x.test/yo/title/rivers',
      'x-default': 'https://x.test/en/title/rivers',
    });
  });
});

describe('listingRobots', () => {
  it('keeps search results and later pages out of the index but followable', () => {
    expect(listingRobots({ kind: 'search' })).toEqual({ index: false, follow: true });
    expect(listingRobots({ kind: 'list', page: 2 })).toEqual({ index: false, follow: true });
  });
  it('leaves page one indexable', () => {
    expect(listingRobots({ kind: 'list', page: 1 })).toEqual({ index: true, follow: true });
  });
});
