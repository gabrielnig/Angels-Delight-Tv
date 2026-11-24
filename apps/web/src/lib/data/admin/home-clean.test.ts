import { describe, expect, it } from 'vitest';
import { cleanHomeConfig } from './home-clean';
import type { HomeConfig } from './home-rules';

const config: HomeConfig = {
  heroIds: ['v1'],
  rows: [
    {
      id: 'r1',
      type: 'manual',
      name: 'Maths week',
      visible: true,
      videoIds: ['v1'],
      sourceId: null,
      slug: 'maths-week',
      viewAllMode: 'custom',
      viewAllUrl: '/browse/maths',
      minItems: 3,
      kidsVisible: false,
    },
  ],
};

describe('cleanHomeConfig', () => {
  it('keeps the slug, View all link, minimum and kids switch through a save', () => {
    expect(cleanHomeConfig(config).rows[0]).toMatchObject({
      slug: 'maths-week',
      viewAllMode: 'custom',
      viewAllUrl: '/browse/maths',
      minItems: 3,
      kidsVisible: false,
    });
  });

  it('drops unknown fields and unknown modes', () => {
    const dirty = {
      heroIds: [],
      rows: [{ ...config.rows[0], viewAllMode: 'evil', extra: 'x' }],
    } as unknown as HomeConfig;
    const row = cleanHomeConfig(dirty).rows[0]! as unknown as Record<string, unknown>;
    expect(row.extra).toBeUndefined();
    expect(row.viewAllMode).toBe('auto');
  });

  it('leaves the new fields unset when the client did not send them', () => {
    const old = { heroIds: [], rows: [{ id: 'r', type: 'newest', name: 'New', visible: true, videoIds: [], sourceId: null }] } as HomeConfig;
    const row = cleanHomeConfig(old).rows[0]! as unknown as Record<string, unknown>;
    expect(row.viewAllMode).toBeUndefined();
    expect(row.minItems).toBeUndefined();
  });

  it('keeps hero text for the chosen titles, trimmed to 80 characters, and nothing else', () => {
    const out = cleanHomeConfig({
      ...config,
      heroText: {
        v1: { headline: 'H'.repeat(120), blurb: 'b', extra: 'x' } as never,
        other: { headline: 'gone' },
      },
    });
    expect(out.heroText).toEqual({ v1: { headline: 'H'.repeat(80), blurb: 'b' } });
  });
});
