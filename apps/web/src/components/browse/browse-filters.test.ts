import { describe, expect, it } from 'vitest';
import { activeChips, browseHref, parseLength, parseSort } from './browse-filters';

describe('browse filters (M06-S02)', () => {
  it('keeps the URL short: defaults are left out', () => {
    expect(browseHref('/browse', 'any', 'newest')).toBe('/browse');
    expect(browseHref('/browse/science', 'short', 'az')).toBe(
      '/browse/science?length=short&sort=az',
    );
  });

  it('offers A to Z and ignores unknown values', () => {
    expect(parseSort('az')).toBe('az');
    expect(parseSort('nonsense')).toBe('newest');
    expect(parseLength('medium')).toBe('medium');
    expect(parseLength('x')).toBe('any');
  });

  it('shows no chip for the defaults', () => {
    expect(activeChips('/browse', 'any', 'newest')).toEqual([]);
  });

  it('shows one removable chip per active choice, each link keeping the other', () => {
    expect(activeChips('/browse', 'short', 'az')).toEqual([
      { label: 'Under 5 min', removeHref: '/browse?sort=az' },
      { label: 'A to Z', removeHref: '/browse?length=short' },
    ]);
  });

  it('keeps old links working: the three length values in saved URLs still parse', () => {
    for (const v of ['short', 'medium', 'long']) expect(parseLength(v)).toBe(v);
    expect(browseHref('/browse', 'medium', 'newest')).toBe('/browse?length=medium');
  });
});
