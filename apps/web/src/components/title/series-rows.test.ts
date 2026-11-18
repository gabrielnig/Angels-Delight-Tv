import { describe, expect, it } from 'vitest';
import type { SeriesDetail } from '../../lib/data';
import { pickSeason, seasonRows } from './series-rows';

const video = (id: string) =>
  ({ id, title: `T${id}`, durationSeconds: 300, description: `d${id}` }) as never;

const seasons: SeriesDetail['seasons'] = [
  {
    number: 1,
    episodes: [
      { video: video('a'), number: 1, blurb: 'b1', watched: true, current: false },
      {
        video: video('b'),
        number: 2,
        blurb: 'b2',
        watched: false,
        current: true,
        progress: { videoId: 'b', positionSeconds: 100, durationSeconds: 300, updatedAt: '' },
      },
    ],
  },
  { number: 2, episodes: [{ video: video('c'), number: 1, blurb: 'b3', watched: false, current: false }] },
];

describe('seasonRows', () => {
  it('maps episodes with progress percent and the current flag', () => {
    const rows = seasonRows(seasons);
    expect(rows[0]!.episodes[1]).toMatchObject({
      number: 2,
      href: '/watch/b',
      percent: 33,
      current: true,
    });
    expect(rows[0]!.episodes[0]).toMatchObject({ watched: true, percent: undefined });
  });
});

describe('pickSeason', () => {
  it('uses the season from the URL when it exists', () => {
    expect(pickSeason(seasons, '2', 1)).toBe(2);
  });
  it('falls back to the season of the main button for a missing or unknown value', () => {
    expect(pickSeason(seasons, undefined, 1)).toBe(1);
    expect(pickSeason(seasons, '9', 1)).toBe(1);
    expect(pickSeason(seasons, 'abc', 1)).toBe(1);
  });
});
