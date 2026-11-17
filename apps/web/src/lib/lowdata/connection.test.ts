import { describe, expect, it, vi } from 'vitest';
import {
  classifyConnection,
  dataSaverPolicy,
  estimateMbPerMinute,
  prefersDataSaverByDefault,
  readConnection,
  requestWantsSaveData,
  subscribeConnection,
  type NavigatorLike,
} from './connection';

const nav = (connection?: Partial<NonNullable<NavigatorLike['connection']>>): NavigatorLike => ({
  connection: connection as NavigatorLike['connection'],
});

describe('readConnection', () => {
  it('reads Save-Data and effective type', () => {
    expect(
      readConnection(nav({ saveData: true, effectiveType: '3g', downlink: 1.2, rtt: 300 })),
    ).toEqual({
      saveData: true,
      effectiveType: '3g',
      downlinkMbps: 1.2,
      rttMs: 300,
      supported: true,
    });
  });
  it('degrades quietly when the API is missing (Safari, Firefox)', () => {
    expect(readConnection({})).toEqual({
      saveData: false,
      effectiveType: null,
      downlinkMbps: null,
      rttMs: null,
      supported: false,
    });
  });
  it('ignores unknown effective types', () => {
    expect(readConnection(nav({ effectiveType: 'warp' as never })).effectiveType).toBeNull();
  });
});

describe('classifyConnection', () => {
  it('maps effective type to a class', () => {
    expect(
      classifyConnection({
        saveData: false,
        effectiveType: 'slow-2g',
        downlinkMbps: null,
        rttMs: null,
        supported: true,
      }),
    ).toBe('slow');
    expect(
      classifyConnection({
        saveData: false,
        effectiveType: '2g',
        downlinkMbps: null,
        rttMs: null,
        supported: true,
      }),
    ).toBe('slow');
    expect(
      classifyConnection({
        saveData: false,
        effectiveType: '3g',
        downlinkMbps: null,
        rttMs: null,
        supported: true,
      }),
    ).toBe('medium');
    expect(
      classifyConnection({
        saveData: false,
        effectiveType: '4g',
        downlinkMbps: 10,
        rttMs: 50,
        supported: true,
      }),
    ).toBe('fast');
  });
  it('treats Save-Data as slow whatever the type says', () => {
    expect(
      classifyConnection({
        saveData: true,
        effectiveType: '4g',
        downlinkMbps: 10,
        rttMs: 50,
        supported: true,
      }),
    ).toBe('slow');
  });
  it('uses downlink when the type is missing and returns unknown with no signal', () => {
    expect(
      classifyConnection({
        saveData: false,
        effectiveType: null,
        downlinkMbps: 0.4,
        rttMs: null,
        supported: true,
      }),
    ).toBe('slow');
    expect(
      classifyConnection({
        saveData: false,
        effectiveType: null,
        downlinkMbps: null,
        rttMs: null,
        supported: false,
      }),
    ).toBe('unknown');
  });
});

describe('prefersDataSaverByDefault', () => {
  it('is true for Save-Data and for slow links, false otherwise', () => {
    expect(prefersDataSaverByDefault(nav({ saveData: true }))).toBe(true);
    expect(prefersDataSaverByDefault(nav({ effectiveType: '2g' }))).toBe(true);
    expect(prefersDataSaverByDefault(nav({ effectiveType: '4g' }))).toBe(false);
    expect(prefersDataSaverByDefault({})).toBe(false);
  });
});

describe('requestWantsSaveData', () => {
  it('reads the Save-Data request header', () => {
    expect(requestWantsSaveData(new Headers({ 'save-data': 'on' }))).toBe(true);
    expect(requestWantsSaveData(new Headers({ 'Save-Data': 'ON' }))).toBe(true);
    expect(requestWantsSaveData(new Headers({ 'save-data': 'off' }))).toBe(false);
    expect(requestWantsSaveData(new Headers())).toBe(false);
  });
});

describe('dataSaverPolicy', () => {
  it('caps quality at 360p and switches off extras when on (M25-S03 AC1)', () => {
    expect(dataSaverPolicy(true)).toEqual({
      maxHeight: 360,
      heroRotation: false,
      hoverPreviews: false,
      posterWidth: 320,
      prefetchNextEpisode: false,
    });
  });
  it('leaves everything open when off', () => {
    expect(dataSaverPolicy(false)).toEqual({
      maxHeight: null,
      heroRotation: true,
      hoverPreviews: true,
      posterWidth: null,
      prefetchNextEpisode: true,
    });
  });
});

describe('estimateMbPerMinute', () => {
  it('gives about 3 MB per minute at 360p', () => {
    expect(estimateMbPerMinute(360)).toBe(3);
  });
  it('grows with height and uses the nearest listed rung at or above', () => {
    expect(estimateMbPerMinute(240)).toBeLessThan(estimateMbPerMinute(360));
    expect(estimateMbPerMinute(480)).toBeGreaterThan(estimateMbPerMinute(360));
    expect(estimateMbPerMinute(400)).toBe(estimateMbPerMinute(480));
    expect(estimateMbPerMinute(5000)).toBe(estimateMbPerMinute(1080));
  });
});

describe('subscribeConnection', () => {
  it('calls back on change and stops after unsubscribe', () => {
    const listeners = new Set<() => void>();
    const connection = {
      saveData: false,
      effectiveType: '4g' as const,
      addEventListener: (_: string, fn: () => void) => listeners.add(fn),
      removeEventListener: (_: string, fn: () => void) => listeners.delete(fn),
    };
    const seen = vi.fn();
    const stop = subscribeConnection({ connection }, seen);
    connection.effectiveType = '2g' as never;
    listeners.forEach((fn) => fn());
    expect(seen).toHaveBeenCalledWith(expect.objectContaining({ effectiveType: '2g' }));
    stop();
    expect(listeners.size).toBe(0);
  });
  it('returns a no-op when unsupported', () => {
    expect(() => subscribeConnection({}, vi.fn())()).not.toThrow();
  });
});
