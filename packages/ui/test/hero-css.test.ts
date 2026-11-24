import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { repoRoot, scanCss } from './css-scan';

const css = readFileSync(resolve(repoRoot, 'packages/ui/src/components.css'), 'utf8');
const rules = scanCss(css);
const flat = (b?: string) =>
  (b ?? '').replace(/\s+/g, ' ').replace(/\( /g, '(').replace(/ \)/g, ')');
const scrim = (desktop: boolean) =>
  rules.find(
    (r) =>
      r.selector === '.ad-hero__scrim' && r.at.some((a) => /min-width: 960px/.test(a)) === desktop,
  );

describe('hero scrim and chip (R12, R36)', () => {
  it('mobile scrim reads the stop tokens, bottom up, with the nav shade on top', () => {
    const body = flat(scrim(false)?.body);
    expect(body).toContain('var(--scrim-hero-hold-mobile)');
    expect(body).toContain('var(--scrim-hero-mid-mobile)');
    expect(body).toContain('var(--scrim-hero-end-mobile)');
    expect(body).toContain('var(--scrim-hero-mid-m)');
    expect(body).toContain('rgba(var(--scrim-rgb), var(--scrim-hero-start))');
    expect(body).not.toMatch(/--color-scrim-/);
  });

  it('desktop scrim holds, then fades left to right using the tokens', () => {
    const body = flat(scrim(true)?.body);
    expect(body).toContain('to right');
    expect(body).toContain('var(--scrim-hero-hold-desktop)');
    expect(body).toContain('var(--scrim-hero-mid-desktop)');
    expect(body).toContain('var(--scrim-hero-end-desktop)');
  });

  it('desktop text stays inside 54 percent of the hero width', () => {
    const text = rules.find(
      (r) => r.selector === '.ad-hero__text' && r.at.some((a) => /min-width: 960px/.test(a)),
    );
    expect(flat(text?.body)).toContain('max-width: min(32.5rem, calc(54% - var(--page-gutter)))');
  });

  it('More info is a translucent chip with a white border', () => {
    const chip = rules.find(
      (r) => r.selector === ".ad-hero__actions .ad-btn[data-variant='on-dark']",
    );
    expect(chip?.body).toMatch(/background:\s*var\(--color-hero-chip-bg\)/);
    expect(chip?.body).toMatch(/border-color:\s*var\(--color-player-ink\)/);
  });

  it('slides crossfade with opacity only', () => {
    expect(rules.find((r) => r.selector === '.ad-hero__slide--leaving')?.body).toMatch(
      /animation:\s*ad-hero-out var\(--hero-fade\) linear forwards/,
    );
    expect(rules.find((r) => r.selector === ".ad-hero__slide[data-fade='true']")?.body).toMatch(
      /animation:\s*ad-hero-in var\(--hero-fade\) linear/,
    );
    expect(css).toMatch(/@keyframes ad-hero-in \{\s*from \{ opacity: 0; \}/);
  });
});
