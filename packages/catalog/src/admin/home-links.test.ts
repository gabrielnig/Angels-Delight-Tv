import { describe, expect, it } from 'vitest';
import {
  MAX_ROW_NAME,
  cleanRowName,
  defaultMinItems,
  validateHomeConfig,
  type HomeConfig,
  type HomeRowConfig,
} from './home';

const row = (extra: Partial<HomeRowConfig> = {}): HomeRowConfig => ({
  id: 'r1',
  type: 'newest',
  name: 'New',
  visible: true,
  videoIds: [],
  sourceId: null,
  ...extra,
});
const config = (...rows: HomeRowConfig[]): HomeConfig => ({ heroIds: [], rows });

describe('section names (M41-S06 AC2)', () => {
  it('trims and collapses double spaces', () => {
    expect(cleanRowName('  Start   here  now ')).toBe('Start here now');
  });
  it('refuses an empty name with the story words', () => {
    expect(validateHomeConfig(config(row({ name: '   ' })))).toBe('Give the section a name');
  });
  it('refuses a name over 60 characters', () => {
    expect(validateHomeConfig(config(row({ name: 'x'.repeat(MAX_ROW_NAME + 1) })))).toBe(
      'Keep the name to 60 characters',
    );
    expect(validateHomeConfig(config(row({ name: 'x'.repeat(MAX_ROW_NAME) })))).toBeNull();
  });
  it('lets two sections share a name', () => {
    expect(validateHomeConfig(config(row({ id: 'a' }), row({ id: 'b' })))).toBeNull();
  });
});

describe('View all and minimum validation (M41-S08 AC2)', () => {
  it('accepts a path and an https link', () => {
    for (const url of ['/browse/farming', 'https://example.org/page'])
      expect(validateHomeConfig(config(row({ viewAllMode: 'custom', viewAllUrl: url })))).toBeNull();
  });
  it.each(['//x.com', 'http://x.com', 'javascript:alert(1)', ''])('refuses %j', (url) => {
    expect(validateHomeConfig(config(row({ viewAllMode: 'custom', viewAllUrl: url })))).toBe(
      'Use a path on this site or an https link',
    );
  });
  it('ignores a stale url when the mode is not custom', () => {
    expect(validateHomeConfig(config(row({ viewAllMode: 'none', viewAllUrl: '//x' })))).toBeNull();
  });
  it('keeps the minimum between 1 and 20', () => {
    expect(validateHomeConfig(config(row({ minItems: 0 })))).toBe('Use a minimum from 1 to 20 titles');
    expect(validateHomeConfig(config(row({ minItems: 21 })))).toBe('Use a minimum from 1 to 20 titles');
    expect(validateHomeConfig(config(row({ minItems: 4 })))).toBeNull();
  });
});

describe('limits (M41-S06 AC4)', () => {
  it('allows 12 sections and refuses 13', () => {
    const many = (n: number) =>
      config(...Array.from({ length: n }, (_, i) => row({ id: `r${i}`, name: `Row ${i}` })));
    expect(validateHomeConfig(many(12))).toBeNull();
    expect(validateHomeConfig(many(13))).toBe('Home can have up to 12 sections.');
  });
});

describe('default minimums per type', () => {
  it('Trending and Each category need 4, All series needs 2, the rest 1', () => {
    expect(defaultMinItems('smart')).toBe(3);
    for (const t of ['trending', 'top_ten', 'most_liked'] as const) expect(defaultMinItems(t)).toBe(5);
    expect(defaultMinItems('each_category')).toBe(4);
    expect(defaultMinItems('all_series')).toBe(2);
    expect(defaultMinItems('manual')).toBe(1);
  });
});

describe('Popular fallback validation (L5 slice 4)', () => {
  it('accepts a fallback title up to 80 characters and refuses longer', () => {
    expect(validateHomeConfig(config(row({ type: 'smart', fallbackToNewest: true, fallbackTitle: 'x'.repeat(80) })))).toBeNull();
    expect(validateHomeConfig(config(row({ type: 'smart', fallbackToNewest: true, fallbackTitle: 'x'.repeat(81) })))).toBe(
      'Keep the fallback title to 80 characters',
    );
  });
});
