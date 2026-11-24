import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const raw = readFileSync(join(__dirname, 'tv.css'), 'utf8');
const css = raw.replace(/\/\*[\s\S]*?\*\//g, '');
const blocks = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({
  selector: (m[1] ?? '').trim(),
  body: m[2] ?? '',
}));

describe('tv.css', () => {
  it('scopes every rule to html[data-tv]', () => {
    for (const b of blocks) {
      if (b.selector.startsWith('@')) continue;
      for (const part of b.selector.split(',')) {
        expect(part.trim(), b.selector).toMatch(/^html\[data-tv\]/);
      }
    }
  });

  it('never removes the focus outline', () => {
    expect(css).not.toMatch(/outline:\s*(none|0)\b/);
  });

  it('draws the ring 4px with a 4px offset from the focus token', () => {
    expect(css).toMatch(/outline:\s*4px solid var\(--color-focus-ring\)/);
    expect(css).toMatch(/outline-offset:\s*4px/);
  });

  it('uses no raw colours', () => {
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(/);
  });

  it('scales type 125 percent, then 150 percent from 1920', () => {
    expect(css).toMatch(/font-size:\s*125%/);
    expect(css).toMatch(/min-width:\s*1920px[\s\S]*font-size:\s*150%/);
  });

  it('shows 4.3 cards and keeps a 5 percent safe area', () => {
    expect(css).toMatch(/--cards-visible:\s*4\.3/);
    expect(css).toMatch(/--tv-safe-x:\s*5vw/);
    expect(css).toMatch(/--tv-safe-y:\s*5vh/);
  });

  it('scales focused tiles only when motion is allowed', () => {
    const m = css.match(
      /@media \(prefers-reduced-motion: no-preference\)\s*\{[\s\S]*?scale\(1\.1\)/,
    );
    expect(m).not.toBeNull();
    expect(css.match(/scale\(1\.1\)/g)).toHaveLength(1);
  });

  it('hides previews', () => {
    expect(css).toMatch(/\[data-preview\][\s\S]*display:\s*none/);
  });
});
