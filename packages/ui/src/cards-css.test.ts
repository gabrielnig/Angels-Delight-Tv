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

describe('card hover and focus css (R10, R31)', () => {
  const hover = block('@container row (min-width: 600px)');

  it('scales on hover after the delay and on keyboard focus at once', () => {
    expect(hover).toMatch(
      /\.ad-card:hover \.ad-card__thumb \{[^}]*scale\(var\(--card-scale\)\)[^}]*transition-delay: var\(--hover-card-delay\)/,
    );
    const focus =
      hover.match(/\.ad-card:has\(:focus-visible\) \.ad-card__thumb \{[^}]*\}/)?.[0] ?? '';
    expect(focus).toMatch(/scale\(var\(--card-scale\)\)/);
    expect(focus).not.toMatch(/transition-delay/);
    expect(hover).toMatch(/\.ad-card:has\(:focus-visible\) \.ad-card__peek \{[^}]*opacity: 1/);
  });

  it('lifts the focused card above its neighbours', () => {
    expect(hover).toMatch(/\.ad-row__item:focus-within \{[^}]*z-index: var\(--z-sticky\)/);
  });

  it('keeps first and last card origins', () => {
    expect(css).toMatch(
      /\.ad-row__item:first-child \.ad-card__thumb \{\s*transform-origin: left center/,
    );
    expect(css).toMatch(
      /\.ad-row__item:last-child \.ad-card__thumb \{\s*transform-origin: right center/,
    );
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
