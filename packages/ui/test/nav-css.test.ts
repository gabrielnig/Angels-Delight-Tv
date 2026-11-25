import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { repoRoot, scanCss } from './css-scan';

const css = readFileSync(resolve(repoRoot, 'packages/ui/src/components.css'), 'utf8');
const rules = scanCss(css);
const flat = (b?: string) =>
  (b ?? '').replace(/\s+/g, ' ').replace(/\( /g, '(').replace(/ \)/g, ')');
const find = (s: string) =>
  rules.find((r) => r.selector.replace(/\s+/g, ' ') === s && r.at.length === 0);

describe('nav layers (R35, M47-S04)', () => {
  it('the solid fade is an opacity transition on a layer, not a gradient swap', () => {
    const before = find('.ad-nav::before');
    expect(before?.body).toMatch(/opacity:\s*0/);
    expect(before?.body).toMatch(/background:\s*var\(--color-surface\)/);
    expect(flat(find('.ad-nav::before, .ad-nav::after')?.body)).toMatch(
      /transition: opacity var\(--motion-base\) linear/,
    );
    expect(find(".ad-nav[data-surface='solid']::before")?.body).toMatch(/opacity:\s*1/);
    expect(find(".ad-nav[data-surface='solid']::after")?.body).toMatch(/opacity:\s*0/);
  });

  it('the scrim holds 0.85 through the whole bar and fades over the fade token below it (D-381)', () => {
    const after = flat(find('.ad-nav::after')?.body);
    expect(after).toContain('calc(100% - var(--nav-scrim-fade))');
    expect(after).toContain('calc(var(--nav-scrim-fade) * -1)');
    expect(after).toContain('rgba(var(--scrim-rgb), var(--scrim-hero-start))');
    expect(after).not.toContain('--nav-scrim-hold');
  });

  it('text, underline and ring flip as one step at 35 percent of the fade', () => {
    expect(flat(find('.ad-nav')?.body)).toContain(
      'transition: color 1ms linear calc(var(--motion-base) * 0.65)',
    );
    const solid = find(".ad-nav[data-surface='solid']");
    expect(flat(solid?.body)).toContain('transition-delay: calc(var(--motion-base) * 0.35)');
    expect(solid?.body).toMatch(/--nav-underline:\s*var\(--color-primary\)/);
    expect(find('.ad-nav')?.body).toMatch(/--nav-underline:\s*var\(--color-focus-ring-dark\)/);
  });

  it('the current page underline is 3px and uses the nav underline colour', () => {
    expect(find(".ad-nav__link[aria-current='page']")?.body).toMatch(
      /box-shadow:\s*inset 0 -3px 0 var\(--nav-underline\)/,
    );
  });

  it('a hero page keeps its negative margin in both states so nothing jumps', () => {
    expect(find(".ad-nav[data-hero='true']")?.body).toMatch(
      /margin-bottom:\s*calc\(var\(--nav-height\) \* -1\)/,
    );
  });

  it('the soft skin and back variants keep their own surfaces', () => {
    expect(
      find(".ad-nav[data-skin='soft']::before, .ad-nav[data-skin='soft']::after")?.body,
    ).toMatch(/display:\s*none/);
    expect(find(".ad-nav[data-back='true']::before")?.body).toMatch(
      /background:\s*var\(--color-bg\)/,
    );
  });
});

describe('phone header rules (L12, S183, S184)', () => {
  it('the name clips with an ellipsis, never wraps, and hides under 400 with a bell and under 340 always', () => {
    const name = find('.ad-nav__name')?.body ?? '';
    expect(name).toMatch(/text-overflow:\s*ellipsis/);
    expect(name).toMatch(/white-space:\s*nowrap/);
    expect(name).toMatch(/min-width:\s*0/);
    const bell = rules.find(
      (r) =>
        r.selector === ".ad-nav[data-bell='true'] .ad-nav__name" &&
        r.at.some((a) => /max-width: 399px/.test(a)),
    );
    expect(bell?.body).toMatch(/display:\s*none/);
    const always = rules.find(
      (r) => r.selector === '.ad-nav__name' && r.at.some((a) => /max-width: 339px/.test(a)),
    );
    expect(always?.body).toMatch(/display:\s*none/);
  });

  it('the Kids badge is a word on the accent fill and the guest actions only show from 960 px', () => {
    const kids = find('.ad-nav__kids')?.body ?? '';
    expect(kids).toMatch(/background:\s*var\(--color-accent\)/);
    expect(kids).toMatch(/color:\s*var\(--color-on-accent\)/);
    expect(find('.ad-nav__guest')?.body).toMatch(/display:\s*none/);
    const wide = rules.find(
      (r) => r.selector === '.ad-nav__guest' && r.at.some((a) => /min-width: 960px/.test(a)),
    );
    expect(wide?.body).toMatch(/display:\s*flex/);
  });

  it('pressed fills use the press token and hover sits inside the fine pointer query', () => {
    const pressed = rules.find(
      (r) => /\.ad-nav__avatar:active/.test(r.selector) && r.at.length === 0,
    );
    expect(pressed?.body).toMatch(/background:\s*var\(--nav-fill\)/);
    expect(pressed?.body).toMatch(/transition-duration:\s*var\(--motion-press\)/);
    const hover = rules.find((r) => /\.ad-nav__avatar:hover/.test(r.selector));
    expect(hover?.at.some((a) => /hover: hover/.test(a))).toBe(true);
    expect(find('.ad-nav')?.body).toMatch(/--nav-fill:\s*var\(--color-player-border\)/);
    expect(find(".ad-nav[data-surface='solid']")?.body).toMatch(
      /--nav-fill:\s*var\(--color-surface-sunken\)/,
    );
  });
});

describe('account sheet rules (L12, S183 frames 7 to 9)', () => {
  it('rows are 52 px with a 44 px minimum on every state and a switch track that moves its thumb', () => {
    expect(find('.ad-sheet__row')?.body).toMatch(/min-height:\s*3\.25rem/);
    expect(find('.ad-sheet__primary')?.body).toMatch(/min-height:\s*3\.25rem/);
    expect(find(".ad-sheet__row[aria-checked='true'] .ad-sheet__track")?.body).toMatch(
      /background:\s*var\(--color-primary\)/,
    );
    expect(find(".ad-sheet__row[aria-checked='true'] .ad-sheet__track::after")?.body).toMatch(
      /translateX/,
    );
  });

  it('hover sits inside the fine pointer query and uses the sunken surface token', () => {
    const hover = rules.find((r) => r.selector === '.ad-sheet__row:hover');
    expect(hover?.at.some((a) => /hover: hover/.test(a))).toBe(true);
    expect(hover?.body).toMatch(/background:\s*var\(--color-surface-sunken\)/);
  });

  it('the help line is muted caption text and the list has no bullets', () => {
    expect(find('.ad-sheet__help')?.body).toMatch(/color:\s*var\(--color-muted\)/);
    expect(find('.ad-sheet__list')?.body).toMatch(/list-style:\s*none/);
  });
});
