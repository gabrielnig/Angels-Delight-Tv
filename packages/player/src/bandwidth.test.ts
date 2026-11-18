import { describe, expect, it } from 'vitest';
import { clampBandwidth, readBandwidthSeed, saveBandwidth } from './bandwidth';
import { createHlsConfig } from './hlsConfig';

function memory(initial: Record<string, string> = {}) {
  const data = { ...initial };
  return {
    data,
    getItem: (k: string) => data[k] ?? null,
    setItem: (k: string, v: string) => void (data[k] = v),
  };
}

describe('bandwidth seed (M08-S18 edge)', () => {
  it('keeps the last measured estimate inside sane limits', () => {
    expect(clampBandwidth(50_000)).toBe(200_000);
    expect(clampBandwidth(900_000)).toBe(900_000);
    expect(clampBandwidth(80_000_000)).toBe(8_000_000);
    expect(clampBandwidth(Number.NaN)).toBeNull();
    expect(clampBandwidth(0)).toBeNull();
  });

  it('saves and reads back through storage on this device', () => {
    const s = memory();
    saveBandwidth(s, 1_200_000);
    expect(readBandwidthSeed(s)).toBe(1_200_000);
  });

  it('returns null with nothing stored, garbage stored or no storage', () => {
    expect(readBandwidthSeed(memory())).toBeNull();
    expect(readBandwidthSeed(memory({ 'ad.bandwidth': 'abc' }))).toBeNull();
    expect(readBandwidthSeed(null)).toBeNull();
  });

  it('never throws when storage is full or blocked', () => {
    const blocked = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('full');
      },
    };
    expect(() => saveBandwidth(blocked, 1_000_000)).not.toThrow();
    expect(readBandwidthSeed(blocked)).toBeNull();
  });

  it('seeds the hls.js estimate and keeps the conservative default without one', () => {
    class Base {
      load() {}
    }
    const base = { appOrigin: 'https://a.test', getToken: () => null, BaseLoader: Base };
    expect(createHlsConfig({ ...base, initialBandwidth: 1_500_000 }).abrEwmaDefaultEstimate).toBe(
      1_500_000,
    );
    expect(createHlsConfig(base).abrEwmaDefaultEstimate).toBe(500_000);
  });
});
