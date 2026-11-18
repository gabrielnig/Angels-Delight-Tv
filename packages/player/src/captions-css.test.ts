import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const css = readFileSync(join(__dirname, 'player.css'), 'utf8');
const cue = /\.adp-video::cue\s*\{([^}]*)\}/.exec(css)?.[1] ?? '';

describe('caption styling (M11-S06)', () => {
  it('has a cue rule', () => {
    expect(cue).not.toBe('');
  });

  it('is at least 16 px, with a dark semi opaque background and light text from tokens', () => {
    const size = /font-size:\s*var\(--adp-cap-size,\s*(\d+)px\)/.exec(cue);
    expect(Number(size?.[1])).toBeGreaterThanOrEqual(16);
    expect(cue).toContain('--color-player-ink');
    expect(cue).toContain('--color-player-control-bg');
  });

  it('lifts captions above the control bar while the controls show', () => {
    expect(css).toMatch(
      /\.adp\[data-controls='visible'\] \.adp-video::-webkit-media-text-track-container\s*\{\s*transform: translateY\(-/,
    );
  });
});
