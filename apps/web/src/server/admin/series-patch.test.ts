import { describe, expect, it } from 'vitest';
import { cleanSeriesPatch } from './series-patch';

describe('cleanSeriesPatch', () => {
  it('keeps every field the editor sends, including rating and names (M51)', () => {
    expect(
      cleanSeriesPatch({
        title: 'T',
        description: 'D',
        published: true,
        maturityRank: 2,
        applyToEpisodes: true,
        labels: { preset: 'part_lesson' },
      }),
    ).toEqual({
      title: 'T',
      description: 'D',
      published: true,
      maturityRank: 2,
      applyToEpisodes: true,
      labels: { preset: 'part_lesson' },
    });
  });

  it('passes null labels through so the series follows the site names', () => {
    expect(cleanSeriesPatch({ labels: null }).labels).toBeNull();
  });

  it('leaves absent fields undefined and coerces types', () => {
    const out = cleanSeriesPatch({ title: 5 as never, published: 1 as never });
    expect(out).toMatchObject({ title: '5', published: true });
    expect(out.labels).toBeUndefined();
    expect(out.maturityRank).toBeUndefined();
  });
});
