import { describe, expect, it } from 'vitest';
import {
  buildQualityMenu,
  detectLowData,
  effectiveCap,
  pickStartHeight,
  type QualityState,
} from './quality';

describe('detectLowData', () => {
  it('is true for Save-Data', () => {
    expect(detectLowData({ saveData: true })).toBe(true);
  });
  it('is true for slow effective types', () => {
    expect(detectLowData({ effectiveType: 'slow-2g' })).toBe(true);
    expect(detectLowData({ effectiveType: '2g' })).toBe(true);
    expect(detectLowData({ effectiveType: '3g' })).toBe(true);
  });
  it('is false for 4g and unknown', () => {
    expect(detectLowData({ effectiveType: '4g' })).toBe(false);
    expect(detectLowData({})).toBe(false);
    expect(detectLowData(undefined)).toBe(false);
  });
});

describe('pickStartHeight', () => {
  const ladder = [240, 360, 480, 720, 1080];
  it('starts at 360 on low data', () => {
    expect(pickStartHeight(ladder, { lowData: true })).toBe(360);
  });
  it('starts at 480 otherwise', () => {
    expect(pickStartHeight(ladder, { lowData: false })).toBe(480);
  });
  it('falls back to the closest available rung at or below the target', () => {
    expect(pickStartHeight([720, 1080], { lowData: true })).toBe(720);
    expect(pickStartHeight([240, 720], { lowData: false })).toBe(240);
  });
  it('respects a cap', () => {
    expect(pickStartHeight(ladder, { lowData: false, cap: 360 })).toBe(360);
  });
  it('returns null for an empty ladder', () => {
    expect(pickStartHeight([], { lowData: true })).toBeNull();
  });
});

describe('effectiveCap', () => {
  it('caps at the data saver ceiling when data saver is on', () => {
    expect(effectiveCap({ dataSaver: true, dataSaverMaxHeight: 360 })).toBe(360);
  });
  it('has no cap otherwise', () => {
    expect(effectiveCap({ dataSaver: false, dataSaverMaxHeight: 360 })).toBeNull();
  });
});

describe('buildQualityMenu', () => {
  const base: QualityState = {
    heights: [360, 480, 720, 1080, 720],
    selected: 'auto',
    currentHeight: 720,
    dataSaver: false,
    dataSaverMaxHeight: 360,
  };
  it('lists Auto then renditions that exist, highest first, once each', () => {
    const menu = buildQualityMenu(base);
    expect(menu.visible).toBe(true);
    expect(menu.items.map((i) => i.id)).toEqual(['auto', '1080', '720', '480', '360']);
    expect(menu.items[0]).toMatchObject({ label: 'Auto', detail: '720p now', selected: true });
  });
  it('marks the manual choice', () => {
    const menu = buildQualityMenu({ ...base, selected: 480 });
    expect(menu.items.find((i) => i.id === '480')?.selected).toBe(true);
    expect(menu.items[0]?.selected).toBe(false);
    expect(menu.buttonLabel).toBe('480p');
  });
  it('shows Auto on the button when auto', () => {
    expect(buildQualityMenu(base).buttonLabel).toBe('Auto');
  });
  it('disables higher rungs with a hint under data saver', () => {
    const menu = buildQualityMenu({ ...base, dataSaver: true, currentHeight: 360 });
    const high = menu.items.filter((i) => i.disabled).map((i) => i.id);
    expect(high).toEqual(['1080', '720', '480']);
    expect(menu.items.find((i) => i.id === '720')?.hint).toBe(
      'Turn off Data saver to use higher quality',
    );
    expect(menu.items.find((i) => i.id === '360')?.disabled).toBe(false);
  });
  it('hides the menu for a single rendition', () => {
    expect(buildQualityMenu({ ...base, heights: [360] }).visible).toBe(false);
  });
});
