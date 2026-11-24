import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const css = readFileSync(join(__dirname, 'player.css'), 'utf8');

/** Removes every block that opens with the given at-rule prelude, so the rest can be inspected. */
function withoutAtRule(source: string, prelude: RegExp): string {
  let out = source;
  for (;;) {
    const m = prelude.exec(out);
    if (!m) return out;
    let depth = 0;
    let i = out.indexOf('{', m.index);
    const start = m.index;
    for (; i < out.length; i += 1) {
      if (out[i] === '{') depth += 1;
      if (out[i] === '}') {
        depth -= 1;
        if (depth === 0) break;
      }
    }
    out = out.slice(0, start) + out.slice(i + 1);
  }
}

function rule(selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const m = new RegExp(`(?:^|\\n)${escaped}\\s*\\{([^}]*)\\}`).exec(css);
  if (!m) throw new Error(`rule ${selector} not found`);
  return m[1]!;
}

function z(selector: string): number {
  const m = /z-index:\s*(-?\d+)/.exec(rule(selector));
  if (!m) throw new Error(`no z-index on ${selector}`);
  return Number(m[1]);
}

describe('seek bar (L4-04, R30, R34)', () => {
  it('has a 44 px hit area from the touch target token', () => {
    expect(rule('.adp-seek')).toMatch(/height:\s*var\(--touch-target\)/);
  });

  it('rests the rail at 5 px and grows it to 8 px with transform only', () => {
    expect(rule('.adp-seek__body')).toMatch(/height:\s*8px/);
    const rail = rule('.adp-seek__rail');
    expect(rail).toMatch(/transform:\s*scaleY\(0\.625\)/);
    expect(rail).toMatch(/transition:\s*transform/);
    expect(rail).not.toMatch(/transition:[^;]*height/);
    expect(css).toMatch(/\.adp-seek\[data-dragging\] \.adp-seek__rail[^{]*\{[^}]*transform:\s*scaleY\(1\)/s);
    expect(css).toMatch(/\.adp-seek:focus-visible \.adp-seek__rail[^{]*\{[^}]*transform:\s*scaleY\(1\)/s);
  });

  it('keeps the thumb inside the rail middle when the rail rests', () => {
    expect(rule('.adp-seek__thumb')).toMatch(/transition:\s*transform/);
  });
});

describe('hover rules (R31)', () => {
  it('has no :hover outside the hover and fine pointer media query', () => {
    const outside = withoutAtRule(css, /@media\s*\(hover:\s*hover\)\s*and\s*\(pointer:\s*fine\)/);
    expect(outside).not.toMatch(/:hover/);
  });

  it('still has hover rules for controls, menu rows and buttons inside the query', () => {
    const inside = /@media\s*\(hover:\s*hover\)\s*and\s*\(pointer:\s*fine\)\s*\{([\s\S]*?)\n\}/.exec(css);
    expect(inside?.[1]).toMatch(/\.adp-ctl:hover/);
    expect(inside?.[1]).toMatch(/\.adp-menu__row:hover/);
    expect(inside?.[1]).toMatch(/\.adp-seek:hover \.adp-seek__rail/);
  });

  it('uses the standard reduce value for reduced motion', () => {
    expect(css).toMatch(/prefers-reduced-motion:\s*reduce/);
    expect(css).not.toMatch(/prefers-reduced-motion:\s*(?!reduce)\S/);
  });
});

describe('motion tokens', () => {
  it('uses no raw millisecond durations outside the reduced motion block', () => {
    const outside = withoutAtRule(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)/);
    expect(outside).not.toMatch(/\b\d+ms\b/);
  });
});

describe('menu borders and tracks (L4-D18)', () => {
  it('does not use the rail token for borders, ring tracks or dividers', () => {
    expect(css).not.toMatch(/(?:border[a-z-]*|stroke):[^;]*--color-player-rail/);
  });

  it('draws the menu surface from the raised surface token', () => {
    expect(rule('.adp-menu')).toMatch(/background:\s*var\(--color-player-surface-raised\)/);
  });
});

describe('control scrim and stacking order (plan 11.2 items 1 and 2)', () => {
  it('holds 0.9 from the bottom to above the rail and eases out', () => {
    const scrim = rule('.adp::after');
    expect(scrim).toMatch(/90%/);
    expect(scrim).toMatch(/58%/);
    expect(scrim).toMatch(/pointer-events:\s*none/);
  });

  it('paints no background on the control bar itself', () => {
    expect(rule('.adp-controls')).not.toMatch(/background/);
  });

  it('keeps the scrim below the skip button, tile, controls and toasts', () => {
    const scrim = z('.adp::after');
    expect(scrim).toBeLessThan(z('.adp-skip'));
    expect(z('.adp-skip')).toBeLessThan(z('.adp-controls'));
    expect(scrim).toBeLessThan(z('.adp-tile'));
    expect(z('.adp-tile')).toBeLessThan(z('.adp-controls'));
    expect(z('.adp-controls')).toBeLessThan(z('.adp-toast'));
  });

  it('lifts the captions above the scrim while the controls show', () => {
    expect(css).toMatch(/\.adp\[data-controls='visible'\] \.adp-video::-webkit-media-text-track-container/);
  });

  it('gives the top bar its own scrim', () => {
    expect(rule('.adp-top')).toMatch(/linear-gradient\(to bottom/);
  });
});

describe('focus on the picture (L4-D16, R37)', () => {
  it('draws a dark inner ring and a yellow outer ring with a transparent forced colours fallback', () => {
    const block = /\.adp-ctl:focus-visible[^{]*\{([^}]*)\}/.exec(css)?.[1] ?? '';
    expect(block).toMatch(/outline:\s*3px solid var\(--color-focus-ring-dark\)/);
    expect(block).toMatch(/box-shadow:\s*0 0 0 3px var\(--color-player-bg\)/);
    expect(block).toMatch(/outline-offset:\s*3px/);
    expect(css).toMatch(/forced-colors:\s*active[\s\S]*outline-color:\s*(?:Highlight|CanvasText)/);
  });
});

describe('skip button and chapters (M43)', () => {
  it('has a 44 px minimum height, sits 8 px above the seek hit area and fades with opacity only', () => {
    const skip = rule('.adp-skip');
    expect(skip).toMatch(/min-height:\s*var\(--touch-target\)/);
    expect(skip).toMatch(/bottom:\s*7\.375rem/);
    expect(skip).toMatch(/transition:\s*opacity/);
    expect(skip).not.toMatch(/transition:[^;]*(transform|all)/);
  });

  it('uses tokens only', () => {
    expect(rule('.adp-skip')).not.toMatch(/#[0-9a-fA-F]{3,6}|rgb\(/);
  });

  it('takes the Up next tile out of the way while it shows', () => {
    expect(css).toMatch(/\.adp\[data-skip\] \.adp-tile\s*\{[^}]*bottom:/s);
  });

  it('gives the chapter label an ellipsis at 24 characters', () => {
    const label = rule('.adp-chapter');
    expect(label).toMatch(/max-width:\s*24ch/);
    expect(label).toMatch(/text-overflow:\s*ellipsis/);
  });

  it('keeps the skip button on the two ring focus list', () => {
    expect(css).toMatch(/\.adp-skip:focus-visible,[\s\S]*?\{[^}]*box-shadow:\s*0 0 0 3px var\(--color-player-bg\)/);
  });
});
