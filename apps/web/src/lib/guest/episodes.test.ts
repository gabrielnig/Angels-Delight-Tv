import { describe, expect, it } from 'vitest';
import type { SeasonRows } from '../../components/title/EpisodeList';
import { applyGuestProgress } from './episodes';

const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';
const C = '33333333-3333-4333-8333-333333333333';
const ep = (n: number, id: string) => ({
  number: n,
  title: `T${n}`,
  blurb: '',
  durationSeconds: 600,
  href: `/watch/${id}`,
  watched: false,
});
const seasons: SeasonRows[] = [{ number: 1, episodes: [ep(1, A), ep(2, B), ep(3, C)] }];

describe('applyGuestProgress', () => {
  it('marks finished and partly watched episodes and points Up next at the first unfinished one', () => {
    const out = applyGuestProgress(seasons, {
      [A]: { p: 590, d: 600, f: true, t: 1 },
      [B]: { p: 300, d: 600, f: false, t: 2 },
    });
    const eps = out[0]!.episodes;
    expect(eps[0]).toMatchObject({ watched: true });
    expect(eps[1]).toMatchObject({ watched: false, percent: 50, current: true });
    expect(eps[2]!.current).toBeFalsy();
  });

  it('changes nothing when nothing is saved on this device', () => {
    expect(applyGuestProgress(seasons, {})).toEqual(seasons);
  });
});
