import {
  defaultHomeConfig as realDefault,
  launchHomeConfig as realLaunch,
  validateHomeConfig,
  defaultMinItems as realMin,
} from '@ad/catalog';
import { describe, expect, it } from 'vitest';
import { defaultHome, defaultMinItems, launchHome, validateConfig, type HomeConfig, type HomeRow, type HomeRowType } from './home-rules';

/** The fixture admin and the real admin keep their own copies of the rules. This keeps them saying the same thing (F26). */
const row = (extra: Partial<HomeRow> = {}): HomeRow => ({
  id: 'r',
  type: 'newest',
  name: 'New',
  visible: true,
  videoIds: [],
  sourceId: null,
  ...extra,
});
const config = (...rows: HomeRow[]): HomeConfig => ({ heroIds: [], rows });

const cases: [string, HomeConfig][] = [
  ['fine', config(row())],
  ['empty name', config(row({ name: '  ' }))],
  ['long name', config(row({ name: 'x'.repeat(61) }))],
  ['bad custom link', config(row({ viewAllMode: 'custom', viewAllUrl: '//x.com' }))],
  ['good custom link', config(row({ viewAllMode: 'custom', viewAllUrl: '/browse/x' }))],
  ['minimum 0', config(row({ minItems: 0 }))],
  ['minimum 21', config(row({ minItems: 21 }))],
  ['too many', config(...Array.from({ length: 13 }, (_, i) => row({ id: `r${i}`, name: `R${i}` })))],
  ['too many heroes', { heroIds: ['1', '2', '3', '4', '5', '6'], rows: [] }],
];

describe('home rules parity (fixtures and real)', () => {
  it.each(cases)('validates %s the same way', (_name, input) => {
    expect(validateConfig(input)).toBe(validateHomeConfig(input as never));
  });

  it('shares the default minimums', () => {
    const types: HomeRowType[] = ['manual', 'category', 'newest', 'series', 'smart', 'each_category', 'all_series', 'continue_watching', 'my_list'];
    for (const type of types) expect(defaultMinItems(type), type).toBe(realMin(type));
  });
});

describe('home defaults parity (fixtures and real)', () => {
  it('starts from the same plain layout', () => {
    expect(defaultHome()).toEqual(realDefault());
  });
  it('builds the same launch layout, with and without client titles', () => {
    expect(launchHome()).toEqual(realLaunch());
    const titles = { continueTitle: 'Keep learning', newTitle: 'Fresh', trendingTitle: 'Popular' };
    expect(launchHome(titles)).toEqual(realLaunch(titles));
  });
});
