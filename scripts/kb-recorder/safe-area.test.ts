import { describe, expect, it } from 'vitest';
import { PROFILES } from './profiles';
import { captionBand, captionPlacement, reachableBottom } from './safe-area';

describe('safe area', () => {
  it('reserves a caption band at the bottom that grows with the font and the margin', () => {
    const d = captionBand(PROFILES.desktop);
    const m = captionBand(PROFILES.mobile);
    expect(d.bottom).toBeGreaterThanOrEqual(
      PROFILES.desktop.captionMarginV + PROFILES.desktop.captionFontSize * 2,
    );
    expect(m.bottom).toBeGreaterThan(PROFILES.mobile.captionMarginV);
    expect(d.bottom).toBeLessThan(PROFILES.desktop.height / 3);
  });

  it('puts the caption at the top when the target would sit under it', () => {
    const band = captionBand(PROFILES.desktop);
    const view = { width: 1280, height: 720 };
    expect(captionPlacement({ x: 100, y: 660, width: 200, height: 40 }, view, band)).toBe('top');
    expect(captionPlacement({ x: 100, y: 200, width: 200, height: 40 }, view, band)).toBe('bottom');
  });

  it('keeps the caption at the bottom when the target is at the top and also under a top caption', () => {
    const band = captionBand(PROFILES.desktop);
    const view = { width: 1280, height: 720 };
    expect(captionPlacement({ x: 0, y: 0, width: 300, height: 60 }, view, band)).toBe('bottom');
  });

  it('reachableBottom is the lowest y a target may reach and stay clear of the caption', () => {
    const band = captionBand(PROFILES.mobile);
    expect(reachableBottom({ width: 390, height: 844 }, band)).toBe(844 - band.bottom);
  });
});
