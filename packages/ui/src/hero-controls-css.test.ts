import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { scanCss } from '../test/css-scan';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
const tokens = read('./tokens.css');
const rules = scanCss(read('./components.css'), 'components.css');
const root = scanCss(tokens, 'tokens.css').filter(
  (r) => r.selector === ':root' && r.at.length === 0,
);
const token = (name: string) =>
  root.map((r) => new RegExp(`${name}:\\s*([^;]+);`).exec(r.body)?.[1]?.trim()).find(Boolean);
const body = (selector: string, media = '') =>
  rules
    .filter(
      (r) =>
        r.selector
          .split(',')
          .map((x) => x.trim())
          .includes(selector) && (media ? r.at.some((a) => a.includes(media)) : r.at.length === 0),
    )
    .map((r) => r.body)
    .join('\n');

describe('hero control tokens (S187, D-368)', () => {
  it('adds the four fixed colours as tokens, so no component holds a raw colour', () => {
    expect(token('--color-hero-track')).toBe('rgba(255, 255, 255, 0.4)');
    expect(token('--color-hero-track-done')).toBe('rgba(255, 255, 255, 0.95)');
    expect(token('--color-hero-border')).toBe('rgba(255, 255, 255, 0.85)');
    expect(token('--color-hero-chip-hover')).toBe('rgba(14, 15, 19, 0.8)');
  });
});

describe('hero sound button and indicator CSS (S187)', () => {
  it('the sound button is a 44 px pill that looks like Pause, with the token border and fill', () => {
    const rule = rules.find((r) =>
      r.selector
        .split(',')
        .map((s) => s.trim())
        .includes('.ad-hero__sound'),
    );
    expect(rule, 'a rule for .ad-hero__sound').toBeTruthy();
    expect(rule!.body).toContain('min-height: var(--touch-target)');
    expect(rule!.body).toContain('min-width: var(--touch-target)');
    expect(rule!.body).toContain('var(--color-hero-border)');
    expect(rule!.body).toContain('var(--color-hero-chip-bg)');
  });

  it('shows the word beside the icon from 960 px and only the icon on phones', () => {
    expect(body('.ad-hero__sound-text')).toContain('clip-path: inset(50%)');
    expect(body('.ad-hero__sound-text', 'min-width: 960px')).toContain('clip-path: none');
  });

  it('reserves the slot so Pause and the arrows never move: 44 px on phones, 124 px from 960 px', () => {
    expect(body('.ad-hero__sound-slot')).toContain('min-width: var(--touch-target)');
    expect(body('.ad-hero__sound-slot', 'min-width: 960px')).toContain('min-width: 7.75rem');
  });

  it('draws the R37 focus ring on dark, 3 px with a 2 px offset', () => {
    const ring = rules.find(
      (r) =>
        r.selector.includes('.ad-hero__sound:focus-visible') ||
        r.body.includes('.ad-hero__sound:focus-visible'),
    );
    const text = rules
      .filter((r) => r.selector.includes('.ad-hero__sound:focus-visible'))
      .map((r) => r.body)
      .join('\n');
    expect(ring || text).toBeTruthy();
    expect(text).toContain('outline: 3px solid var(--color-focus-ring-dark)');
    expect(text).toContain('outline-offset: 2px');
  });

  it('hover only changes the pill where a mouse can hover', () => {
    const hover = rules.filter((r) => r.selector.includes('.ad-hero__sound:hover'));
    expect(hover.length).toBeGreaterThan(0);
    for (const rule of hover) expect(rule.at.join(' ')).toMatch(/hover: hover/);
  });

  it('the slide indicator is five 56 by 6 px segments in 44 px high hit areas, 8 px apart', () => {
    const dot = body('.ad-hero__dot');
    expect(dot).toContain('width: 3.5rem');
    expect(dot).toContain('height: var(--touch-target)');
    expect(dot).toContain('margin-inline-end: var(--space-2)');
    const track = body('.ad-hero__dot span');
    expect(track).toContain('height: 0.375rem');
    expect(track).toContain('var(--color-hero-track)');
    expect(body(".ad-hero__dot[data-done='true'] span")).toContain('var(--color-hero-track-done)');
    expect(body('.ad-hero__dot', 'max-width: 959px')).toContain('width: var(--touch-target)');
    expect(body('.ad-hero__dot span', 'max-width: 959px')).toContain('width: 2.25rem');
  });

  it('a current segment with no fill (rotation stopped or off) is a solid bar', () => {
    expect(body(".ad-hero__dot[aria-current='true'] span:not([data-filling])")).toContain(
      'var(--color-hero-track-done)',
    );
  });

  it('hero chrome uses tokens, not raw white or black values', () => {
    const chrome = rules.filter((r) => /\.ad-hero__(sound|dot|pause|fill)/.test(r.selector));
    for (const rule of chrome) expect(rule.body, rule.selector).not.toMatch(/rgba?\(\s*\d/);
  });
});
