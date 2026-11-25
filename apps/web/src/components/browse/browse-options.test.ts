import { describe, expect, it } from 'vitest';
import { msg } from '@ad/shared/messages';
import { lengthOptions, sortOptions } from './browse-options';

describe('browse menu options (L11 slice 2)', () => {
  it('offers the four lengths with the labels the data really uses', () => {
    expect(lengthOptions(msg).map((o) => [o.value, o.label])).toEqual([
      ['any', 'Any length'],
      ['short', 'Under 5 min'],
      ['medium', '5 to 15 min'],
      ['long', 'Over 15 min'],
    ]);
  });
  it('uses a short word on the button for the default length', () => {
    expect(lengthOptions(msg)[0]!.short).toBe('Any');
  });
  it('offers the four sorts', () => {
    expect(sortOptions(msg).map((o) => [o.value, o.label])).toEqual([
      ['newest', 'Newest'],
      ['shortest', 'Shortest'],
      ['longest', 'Longest'],
      ['az', 'A to Z'],
    ]);
  });
});
