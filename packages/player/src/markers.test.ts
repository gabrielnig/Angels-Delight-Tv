import { describe, expect, it } from 'vitest';
import { activeMarker, normalizeMarkers, type PlayerMarkers } from './markers';

const markers: PlayerMarkers = {
  intro: { start: 12, end: 48 },
  recap: { start: 60, end: 90 },
  credits: { start: 540, end: null },
};

describe('activeMarker', () => {
  it('finds no marker outside every window', () => {
    expect(activeMarker(markers, 5, 600, false)).toBeNull();
    expect(activeMarker(markers, 55, 600, false)).toBeNull();
    expect(activeMarker(markers, 48, 600, false)).toBeNull();
  });

  it('finds the intro inside its window', () => {
    expect(activeMarker(markers, 12, 600, false)).toEqual({
      kind: 'intro',
      skipTo: 48,
      nextLesson: false,
    });
    expect(activeMarker(markers, 30, 600, true)?.kind).toBe('intro');
  });

  it('treats a null credits end as the video end', () => {
    expect(activeMarker(markers, 560, 600, false)).toEqual({
      kind: 'credits',
      skipTo: 600,
      nextLesson: false,
    });
  });

  it('returns the window end as the skip target', () => {
    expect(activeMarker(markers, 70, 600, false)?.skipTo).toBe(90);
  });

  it('marks credits as next lesson when a next title exists', () => {
    expect(activeMarker(markers, 560, 600, true)).toEqual({
      kind: 'credits',
      skipTo: 600,
      nextLesson: true,
    });
    expect(activeMarker(markers, 30, 600, true)?.nextLesson).toBe(false);
  });

  it('ignores a marker shorter than 3 seconds', () => {
    expect(activeMarker({ intro: { start: 10, end: 12 } }, 11, 600, false)).toBeNull();
  });

  it('drops windows beyond the duration once it is known', () => {
    expect(activeMarker({ intro: { start: 700, end: 740 } }, 710, 600, false)).toBeNull();
    expect(activeMarker({ credits: { start: 700, end: null } }, 710, 600, false)).toBeNull();
  });

  it('credits wins over recap when windows touch', () => {
    const touching: PlayerMarkers = {
      recap: { start: 500, end: 560 },
      credits: { start: 540, end: null },
    };
    expect(activeMarker(touching, 545, 600, false)?.kind).toBe('credits');
  });

  it('works while the duration is not known yet', () => {
    expect(activeMarker(markers, 20, Number.NaN, false)?.kind).toBe('intro');
    expect(activeMarker({ credits: { start: 540, end: null } }, 560, Number.NaN, true)).toBeNull();
  });

  it('returns null with no markers at all', () => {
    expect(activeMarker(undefined, 10, 600, true)).toBeNull();
    expect(activeMarker({}, 10, 600, true)).toBeNull();
  });
});

describe('normalizeMarkers', () => {
  it('clamps an end past the duration and drops windows that start past it', () => {
    const out = normalizeMarkers(
      { intro: { start: 590, end: 640 }, recap: { start: 700, end: 760 } },
      600,
    );
    expect(out.intro).toEqual({ start: 590, end: 600 });
    expect(out.recap).toBeUndefined();
  });

  it('drops negative or reversed windows', () => {
    expect(normalizeMarkers({ intro: { start: 30, end: 10 } }, 600)).toEqual({});
    expect(normalizeMarkers({ intro: { start: -5, end: 10 } }, 600)).toEqual({});
  });
});
