import { describe, expect, it } from 'vitest';
import {
  LAUNCH_HOME_SECTIONS,
  defaultHomeConfig,
  launchHomeConfig,
  validateHomeConfig,
} from './home';

describe('launch home sections (M41-S09)', () => {
  it('lists the six sections in page order with their minimums', () => {
    expect(
      LAUNCH_HOME_SECTIONS.map((s) => [s.type, s.name, s.minItems]),
    ).toEqual([
      ['continue_watching', 'Continue learning', 1],
      ['my_list', 'My List', 1],
      ['trending', 'Trending now', 5],
      ['newest', 'Newly added', 1],
      ['each_category', 'Browse by subject', 4],
      ['all_series', 'Series', 2],
    ]);
  });

  it('builds a valid visible config, automatic links, kids visible, no hero titles', () => {
    const config = launchHomeConfig();
    expect(validateHomeConfig(config)).toBeNull();
    expect(config.heroIds).toEqual([]);
    for (const row of config.rows) {
      expect(row.visible).toBe(true);
      expect(row.kidsVisible).toBe(true);
      expect(row.viewAllMode).toBe('auto');
      expect(row.videoIds).toEqual([]);
    }
    expect(new Set(config.rows.map((r) => r.id)).size).toBe(config.rows.length);
  });

  it('takes section titles from config and falls back when blank', () => {
    const config = launchHomeConfig({ continueTitle: ' Keep learning ', newTitle: 'Fresh', trendingTitle: '  ' });
    expect(config.rows.map((r) => r.name)).toEqual([
      'Keep learning',
      'My List',
      'Trending now',
      'Fresh',
      'Browse by subject',
      'Series',
    ]);
  });

  it('gives each call its own objects so one run cannot change the next', () => {
    const a = launchHomeConfig();
    a.rows[0]!.name = 'Changed';
    expect(launchHomeConfig().rows[0]!.name).toBe('Continue learning');
  });

  it('puts My List straight after Continue learning in the plain default too', () => {
    const config = defaultHomeConfig();
    expect(config.rows.map((r) => r.type).slice(0, 2)).toEqual(['continue_watching', 'my_list']);
    expect(config.rows[0]!.name).toBe('Continue learning');
  });
});
