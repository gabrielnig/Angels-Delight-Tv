import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { scanCss } from '../test/css-scan';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
const tokens = read('./tokens.css');
const components = read('./components.css');
const doc = read('../../../docs/DESIGN-SYSTEM.md');
const rules = scanCss(tokens, 'tokens.css').filter((r) => r.selector === ':root');

/** Value of a custom property on :root inside the given media prelude ('' means no media). */
function prop(name: string, media = ''): string | undefined {
  const hit = rules
    .filter((r) => (media === '' ? r.at.length === 0 : r.at.some((a) => a.includes(media))))
    .map((r) => new RegExp(`${name}:\\s*([^;]+);`).exec(r.body)?.[1]?.trim())
    .filter((v): v is string => Boolean(v));
  return hit.at(-1);
}

describe('layout tokens (R11, M47-S01)', () => {
  it('cards visible are 2.3, 3.3, 4.3, 5.3 and 6.3 at 0, 600, 960, 1280 and 1920', () => {
    expect(prop('--cards-visible')).toBe('2.3');
    expect(prop('--cards-visible', 'min-width: 600px')).toBe('3.3');
    expect(prop('--cards-visible', 'min-width: 960px')).toBe('4.3');
    expect(prop('--cards-visible', 'min-width: 1280px')).toBe('5.3');
    expect(prop('--cards-visible', 'min-width: 1920px')).toBe('6.3');
  });

  it('a 1920 media block exists and 2560 does not', () => {
    expect(tokens).toMatch(/@media \(min-width: 1920px\)/);
    expect(tokens).not.toMatch(/2560/);
  });

  it('page gutter is one clamp with no per breakpoint override', () => {
    expect(prop('--page-gutter')).toBe('clamp(1rem, 4vw, 3.5rem)');
    expect(tokens.match(/--page-gutter:/g)).toHaveLength(1);
  });

  it('card gap is 8 below 960 and 12 from 960', () => {
    expect(prop('--card-gap')).toBe('var(--space-2)');
    expect(prop('--card-gap', 'min-width: 960px')).toBe('var(--space-3)');
  });

  it('rails widen to 120rem at 1920 while prose keeps 90rem', () => {
    expect(prop('--content-max')).toBe('90rem');
    expect(prop('--content-max', 'min-width: 1920px')).toBe('120rem');
    expect(prop('--prose-max')).toBe('90rem');
    const globals = read('../../../apps/web/src/app/globals.css');
    expect(/\.web-page \{[^}]*max-width: var\(--prose-max\)/.test(globals)).toBe(true);
  });

  it('tab bar and avatar initials have tokens', () => {
    expect(prop('--tabbar-height')).toBe('3.5rem');
    expect(prop('--avatar-initial-120')).toBe('2.5rem');
    expect(prop('--avatar-initial-160')).toBe('3.5rem');
    expect(components).not.toMatch(/data-size='(120|160)'\][^}]*--text-hero/);
  });
});

describe('type tokens (DEC-L8-05, M47-S09)', () => {
  const scaled = (rem: string) => `calc(${rem}rem * var(--type-scale))`;
  it('below 960 h1 to lead are 28, 24, 20, 18 and 17', () => {
    expect(prop('--text-h1')).toBe(scaled('1.75'));
    expect(prop('--text-h2')).toBe(scaled('1.5'));
    expect(prop('--text-h3')).toBe(scaled('1.25'));
    expect(prop('--text-h4')).toBe(scaled('1.125'));
    expect(prop('--text-lead')).toBe(scaled('1.0625'));
  });
  it('from 960 they are 40, 32, 24, 20 and 18', () => {
    const m = 'min-width: 960px';
    expect(prop('--text-h1', m)).toBe(scaled('2.5'));
    expect(prop('--text-h2', m)).toBe(scaled('2'));
    expect(prop('--text-h3', m)).toBe(scaled('1.5'));
    expect(prop('--text-h4', m)).toBe(scaled('1.25'));
    expect(prop('--text-lead', m)).toBe(scaled('1.125'));
  });
  it('the hero token is a clamp and no component overrides it', () => {
    expect(prop('--text-hero')).toBe('calc(clamp(2rem, 5vw, 3.5rem) * var(--type-scale))');
    expect(prop('--text-hero', 'min-width: 960px')).toBeUndefined();
    const title = scanCss(components).filter((r) => r.selector === '.ad-hero__title');
    expect(title.map((r) => /font-size:\s*([^;]+);/.exec(r.body)?.[1])).toEqual([
      'var(--text-hero)',
    ]);
  });
});

describe('button and motion tokens (R10, M47-S07, M47-S08)', () => {
  it('button heights are 2, 2.5 and 3rem', () => {
    expect(prop('--button-height-sm')).toBe('2rem');
    expect(prop('--button-height-md')).toBe('2.5rem');
    expect(prop('--button-height-lg')).toBe('3rem');
    expect(prop('--button-pad-x')).toBe('1rem');
    expect(prop('--icon-gap')).toBe('0.5rem');
  });

  it('hover 250ms, press 0ms, strong ease out, hover card delay 300ms, scale 1.25', () => {
    expect(prop('--motion-hover')).toBe('250ms');
    expect(prop('--motion-press')).toBe('0ms');
    expect(prop('--ease-out-strong')).toBe('cubic-bezier(0.22, 1, 0.36, 1)');
    expect(prop('--hover-card-delay')).toBe('300ms');
    expect(prop('--card-scale')).toBe('1.25');
    expect(prop('--hover-intent-delay')).toBe('var(--hover-card-delay)');
  });

  it('the reduce block zeroes every duration and the hover card delay', () => {
    expect(tokens).toMatch(/@media \(prefers-reduced-motion: reduce\)/);
    const reduce = 'prefers-reduced-motion: reduce';
    for (const name of [
      '--motion-instant',
      '--motion-fast',
      '--motion-base',
      '--motion-slow',
      '--motion-hover',
    ]) {
      expect(prop(name, reduce)).toBe('0.01ms');
    }
    expect(prop('--motion-press', reduce)).toBe('0ms');
    expect(prop('--hover-card-delay', reduce)).toBe('0ms');
  });
});

describe('fixed colour and scrim tokens (section 13.1)', () => {
  it.each([
    ['--color-card-progress-rail', '#3A3D46'],
    ['--color-bar-disabled-bg', '#3A3D46'],
    ['--color-bar-disabled-ink', '#C9CCD3'],
    ['--color-hero-chip-bg', 'rgba(14, 15, 19, 0.6)'],
    ['--scrim-rgb', '14, 15, 19'],
    ['--scrim-hero-start', '0.85'],
    ['--scrim-hero-mid', '0.45'],
    ['--scrim-hero-end', '0'],
    ['--scrim-hero-hold-desktop', '40%'],
    ['--scrim-hero-mid-desktop', '60%'],
    ['--scrim-hero-end-desktop', '100%'],
    ['--scrim-hero-hold-mobile', '50%'],
    ['--scrim-hero-mid-mobile', '65%'],
    ['--scrim-hero-end-mobile', '80%'],
    ['--nav-scrim-hold', '70%'],
    ['--font-mono', 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace'],
  ])('%s is %s', (name, value) => {
    expect(prop(name)).toBe(value);
  });

  it('the card progress accent rail uses its own token, not the player rail', () => {
    const rail = scanCss(components).find(
      (r) => r.selector === ".ad-progress[data-tone='accent'] .ad-progress__rail",
    );
    expect(rail?.body).toContain('--color-card-progress-rail');
  });
});

describe('docs and the skill copy stay in step', () => {
  it('every token added by M47 is in the design system doc', () => {
    for (const name of [
      '--card-scale',
      '--hover-card-delay',
      '--motion-hover',
      '--motion-press',
      '--ease-out-strong',
      '--button-height-sm',
      '--color-card-progress-rail',
      '--color-bar-disabled-bg',
      '--color-hero-chip-bg',
      '--scrim-hero-start',
      '--nav-scrim-hold',
      '--tabbar-height',
      '--avatar-initial-120',
      '--prose-max',
    ]) {
      expect(doc, name).toContain(`\`${name}`);
    }
  });
});
