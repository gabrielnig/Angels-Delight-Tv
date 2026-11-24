import { describe, expect, it } from 'vitest';
import { heroPreviewEligible, type HeroPreviewInput } from './hero-preview';
import type { ConnectionInfo } from './connection';

const fast: ConnectionInfo = { saveData: false, effectiveType: '4g', downlinkMbps: 10, rttMs: 50, supported: true };
const base = (over: Partial<HeroPreviewInput> = {}): HeroPreviewInput => ({
  enabled: true,
  dataSaver: false,
  connection: fast,
  allowUnknown: false,
  reducedMotion: false,
  hidden: false,
  ...over,
});

describe('heroPreviewEligible', () => {
  it('plays on a fast connection with Data saver off', () => {
    expect(heroPreviewEligible(base())).toBe(true);
  });
  it('stays off when the site switch is off', () => {
    expect(heroPreviewEligible(base({ enabled: false }))).toBe(false);
  });
  it('stays off under Data saver, including the browser Save-Data signal', () => {
    expect(heroPreviewEligible(base({ dataSaver: true }))).toBe(false);
    expect(heroPreviewEligible(base({ connection: { ...fast, saveData: true } }))).toBe(false);
  });
  it('stays off on 3g and 2g, and on a fast type with a low downlink', () => {
    expect(heroPreviewEligible(base({ connection: { ...fast, effectiveType: '3g' } }))).toBe(false);
    expect(heroPreviewEligible(base({ connection: { ...fast, effectiveType: '2g' } }))).toBe(false);
    expect(heroPreviewEligible(base({ connection: { ...fast, downlinkMbps: 3 } }))).toBe(false);
  });
  it('treats an unknown connection as not eligible unless the setting allows it', () => {
    const unknown: ConnectionInfo = { saveData: false, effectiveType: null, downlinkMbps: null, rttMs: null, supported: false };
    expect(heroPreviewEligible(base({ connection: unknown }))).toBe(false);
    expect(heroPreviewEligible(base({ connection: unknown, allowUnknown: true }))).toBe(true);
  });
  it('stays off under reduced motion and in a hidden tab', () => {
    expect(heroPreviewEligible(base({ reducedMotion: true }))).toBe(false);
    expect(heroPreviewEligible(base({ hidden: true }))).toBe(false);
  });
});
