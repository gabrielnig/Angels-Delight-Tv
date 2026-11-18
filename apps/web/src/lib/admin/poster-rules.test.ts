import { describe, expect, it } from 'vitest';
import {
  validatePosterChoice,
  candidateFrames,
  clampFocus,
  focusFromPoint,
  cropPreviewStyle,
  previewStyle,
  validatePosterFile,
} from './poster-rules';

describe('validatePosterFile', () => {
  const ok = { type: 'image/jpeg', size: 1_000_000, width: 1920, height: 1080 };
  it('accepts a JPG or PNG that is big enough', () => {
    expect(validatePosterFile(ok)).toBeNull();
    expect(validatePosterFile({ ...ok, type: 'image/png' })).toBeNull();
  });
  it('explains each rejection in plain words', () => {
    expect(validatePosterFile({ ...ok, type: 'image/gif' })).toBe('Use a JPG or PNG image.');
    expect(validatePosterFile({ ...ok, size: 6 * 1024 * 1024 })).toBe(
      'That image is over 5 MB. Choose a smaller one.',
    );
    expect(validatePosterFile({ ...ok, width: 800, height: 450 })).toBe(
      'That image is 800 by 450. Use at least 1280 by 720.',
    );
  });
});

describe('focus point', () => {
  it('clamps to 0 to 100', () => {
    expect(clampFocus({ x: -5, y: 140 })).toEqual({ x: 0, y: 100 });
  });
  it('turns a click into a percentage of the picture', () => {
    expect(focusFromPoint({ left: 100, top: 50, width: 400, height: 200 }, 300, 100)).toEqual({
      x: 50,
      y: 25,
    });
  });
  it('builds a preview style that keeps the focus in view and zooms around it', () => {
    expect(previewStyle({ x: 58, y: 42 }, 150)).toEqual({
      objectPosition: '58% 42%',
      transform: 'scale(1.5)',
      transformOrigin: '58% 42%',
    });
    expect(previewStyle({ x: 50, y: 50 }, 100).transform).toBe('scale(1)');
  });
});

describe('candidateFrames', () => {
  it('picks six evenly spaced frames inside the video', () => {
    const frames = candidateFrames(363);
    expect(frames).toHaveLength(6);
    expect(frames[0]).toBeGreaterThan(0);
    expect(frames.at(-1)).toBeLessThan(363);
    expect([...frames].sort((a, b) => a - b)).toEqual(frames);
  });
  it('copes with very short videos', () => {
    expect(candidateFrames(3)).toHaveLength(6);
  });
});

describe('validatePosterChoice', () => {
  const good = {
    posterId: 'p1',
    focus: { x: 50, y: 50 },
    zoom: 120,
    alt: 'A student at a bus stop',
  };
  it('passes a complete choice', () => expect(validatePosterChoice(good)).toEqual({}));
  it('needs a frame, alt text and a sane zoom', () => {
    expect(validatePosterChoice({ ...good, posterId: '', alt: ' ', zoom: 300 })).toEqual({
      posterId: 'Pick a frame or upload your own image.',
      alt: 'Describe the poster for people who cannot see it.',
      zoom: 'Zoom must be between 100 and 200 percent.',
    });
  });
});

describe('cropPreviewStyle matches the recut the worker makes (M36-S03)', () => {
  const pct = (v: string) => Number.parseFloat(v);
  it('shows the whole picture at zoom 100 in a 16:9 frame', () => {
    const style = cropPreviewStyle({ x: 30, y: 70 }, 100, 16 / 9);
    expect(pct(style.width)).toBeCloseTo(100);
    expect(pct(style.height)).toBeCloseTo(100);
    expect(pct(style.left) + 0).toBeCloseTo(0);
    expect(pct(style.top) + 0).toBeCloseTo(0);
  });
  it('centres the crop on the focus, as cropRect does', () => {
    // zoom 200 keeps half the picture, centred on x 50 percent: from 25 to 75 percent.
    const style = cropPreviewStyle({ x: 50, y: 50 }, 200, 16 / 9);
    expect(pct(style.width)).toBeCloseTo(200);
    expect(pct(style.left)).toBeCloseTo(-50);
    expect(pct(style.top)).toBeCloseTo(-50);
  });
  it('stops the crop at the picture edge when the focus is near it', () => {
    const style = cropPreviewStyle({ x: 95, y: 5 }, 200, 16 / 9);
    expect(pct(style.left)).toBeCloseTo(-100);
    expect(pct(style.top) + 0).toBeCloseTo(0);
  });
  it('shows a wider frame as a band of the recut, kept around the focus', () => {
    const style = cropPreviewStyle({ x: 50, y: 50 }, 100, 21 / 9);
    expect(pct(style.width)).toBeCloseTo(100);
    expect(pct(style.height)).toBeCloseTo(131.25, 1);
    expect(pct(style.top)).toBeCloseTo(-15.6, 0);
  });
  it('keeps the picture shape: the box is always 16:9 whatever the frame', () => {
    for (const ratio of [21 / 9, 16 / 9, 4 / 5]) {
      const style = cropPreviewStyle({ x: 20, y: 60 }, 150, ratio);
      expect((pct(style.width) * ratio) / pct(style.height)).toBeCloseTo(16 / 9, 3);
    }
  });
});
