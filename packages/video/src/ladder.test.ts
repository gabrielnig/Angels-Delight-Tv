import { describe, expect, it } from 'vitest';
import { DEFAULT_LADDER, codecsFor, parseLadderConfig, planLadder } from './ladder';

describe('planLadder', () => {
  it('produces all four rungs for a 1080p source', () => {
    const plan = planLadder({ width: 1920, height: 1080 });
    expect(plan.map((rung) => rung.height)).toEqual([360, 480, 720, 1080]);
    expect(plan[3]).toMatchObject({ width: 1920, height: 1080, videoKbps: 3500, audioKbps: 128 });
  });

  it('never upscales: a 720p source gets 360, 480 and 720 only', () => {
    expect(planLadder({ width: 1280, height: 720 }).map((rung) => rung.height)).toEqual([
      360, 480, 720,
    ]);
  });

  it('gives a source under 360p a single rung at its own height', () => {
    const plan = planLadder({ width: 320, height: 240 });
    expect(plan).toHaveLength(1);
    expect(plan[0]).toMatchObject({ height: 240, width: 320 });
  });

  it('keeps widths even for odd aspect ratios and portrait sources', () => {
    const portrait = planLadder({ width: 720, height: 1280 });
    for (const rung of portrait) {
      expect(rung.width % 2).toBe(0);
      expect(rung.height % 2).toBe(0);
    }
    expect(portrait[0]).toMatchObject({ height: 360, width: 202 });
  });

  it('rounds an odd source height down to an even number for a tiny source', () => {
    expect(planLadder({ width: 301, height: 201 })[0]?.height).toBe(200);
  });

  it('uses a custom ladder when given one', () => {
    const plan = planLadder({ width: 1920, height: 1080 }, [
      { height: 540, videoKbps: 700, audioKbps: 64, profile: 'main' },
    ]);
    expect(plan.map((rung) => rung.height)).toEqual([540]);
  });
});

describe('parseLadderConfig', () => {
  it('accepts the default ladder', () => {
    expect(parseLadderConfig(DEFAULT_LADDER)).toEqual(DEFAULT_LADDER);
  });
  it('sorts rungs ascending and rejects duplicates and bad values', () => {
    const sorted = parseLadderConfig([
      { height: 720, videoKbps: 1800, audioKbps: 128, profile: 'high' },
      { height: 360, videoKbps: 500, audioKbps: 96, profile: 'main' },
    ]);
    expect(sorted.map((rung) => rung.height)).toEqual([360, 720]);
    expect(() =>
      parseLadderConfig([
        { height: 360, videoKbps: 500, audioKbps: 96, profile: 'main' },
        { height: 360, videoKbps: 600, audioKbps: 96, profile: 'main' },
      ]),
    ).toThrow(/duplicate/i);
    expect(() => parseLadderConfig([])).toThrow();
    expect(() =>
      parseLadderConfig([{ height: 100, videoKbps: 1, audioKbps: 1, profile: 'main' }]),
    ).toThrow();
  });
});

describe('codecsFor', () => {
  it('maps profile and height to an RFC 6381 codecs string', () => {
    expect(codecsFor({ height: 360, profile: 'main' }, true)).toBe('avc1.4d001e,mp4a.40.2');
    expect(codecsFor({ height: 1080, profile: 'high' }, true)).toBe('avc1.640028,mp4a.40.2');
    expect(codecsFor({ height: 720, profile: 'high' }, false)).toBe('avc1.64001f');
  });
});
