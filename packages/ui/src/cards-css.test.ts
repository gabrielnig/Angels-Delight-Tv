import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
const css = read('./components.css');

/** The text of the first block that starts with `opener`, balanced on braces. */
function block(opener: string): string {
  const start = css.indexOf(opener);
  if (start < 0) return '';
  let depth = 0;
  for (let i = css.indexOf('{', start); i < css.length; i++) {
    if (css[i] === '{') depth++;
    if (css[i] === '}' && --depth === 0) return css.slice(start, i + 1);
  }
  return '';
}

describe('card hover css (R10, R31, M41-S12)', () => {
  it('no longer scales the thumbnail or draws an inline peek', () => {
    expect(css).not.toMatch(/ad-card__peek/);
    expect(css).not.toMatch(/\.ad-card:hover \.ad-card__thumb/);
    expect(css).not.toMatch(/\.ad-card__thumb \{[^}]*transform-origin/);
  });

  it('draws the hover card above the row with tokens, and keeps controls visible inside it', () => {
    const card = css.match(/\.ad-hovercard \{[^}]*\}/)?.[0] ?? '';
    expect(card).toMatch(/position: fixed/);
    expect(card).toMatch(/z-index: var\(--z-overlay\)/);
    expect(css).toMatch(/\.ad-hovercard \.ad-card__action \{[^}]*opacity: 1/);
    expect(css).toMatch(/\.ad-hovercard\[data-motion='reduced'\] \{[^}]*animation: none/);
  });

  it('shows the rating chip only for a fine pointer and expands it on hover or focus', () => {
    expect(css).toMatch(/\.ad-card__rate \{\s*display: none/);
    const fine = block('@media (hover: hover) and (pointer: fine) {\n  .ad-card__action:not');
    expect(fine).toMatch(/\.ad-card__rate \{[^}]*display: flex/);
    expect(fine).toMatch(
      /\.ad-card__rate:not\(:hover\):not\(:focus-within\) \.ad-card__rate-extra \{[^}]*display: none/,
    );
  });
});
