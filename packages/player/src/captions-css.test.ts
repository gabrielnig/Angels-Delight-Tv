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

  it('draws the cue edge from the edge variable', () => {
    expect(cue).toMatch(/text-shadow:\s*var\(--adp-cue-edge,\s*none\)/);
  });

  it('styles the appearance preview from the caption variables with tokens only', () => {
    const sample = /\.adp-capstyle__sample\s*\{([^}]*)\}/.exec(css)?.[1] ?? '';
    expect(sample).toContain('var(--adp-cap-fg)');
    expect(sample).toContain('var(--adp-cap-bg)');
    expect(sample).toContain('var(--adp-cue-edge)');
    expect(sample).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    const preview = /\.adp-capstyle__preview\s*\{([^}]*)\}/.exec(css)?.[1] ?? '';
    expect(preview).toContain('var(--color-player-bg)');
  });
});
