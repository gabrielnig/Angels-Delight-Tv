import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync(new URL('./auth-ui.css', import.meta.url), 'utf8');

function rule(selector: string, from = 0): string {
  const start = css.indexOf(`\n${selector} {`, from);
  expect(start, `${selector} rule exists`).toBeGreaterThan(-1);
  return css.slice(start, css.indexOf('}', start));
}

/** Measurements copied from /ad/project/S01*.dc.html and S02*.dc.html. */
describe('auth screens CSS parity with the S01 and S02 mockups', () => {
  it('uses tokens for colour: the only literal colours are the logo glyph and the card shadow', () => {
    const literals = css.match(/#[0-9a-f]{3,8}\b|rgba?\(/gi) ?? [];
    expect(literals.sort()).toEqual(['#12263a', 'rgb('].sort());
  });

  it('draws the brand panel 600px wide with 56px by 64px padding and a 56px display headline', () => {
    expect(css).toMatch(/flex:\s*0 0 min\(600px, 44\.12%\)/);
    expect(css).toMatch(/padding:\s*56px 64px/);
    const headline = rule('.auth-pitch__headline');
    expect(headline).toMatch(/font-size:\s*calc\(56px \* var\(--type-scale\)\)/);
    expect(headline).toMatch(/line-height:\s*1\.05/);
    expect(headline).toMatch(/letter-spacing:\s*-0\.02em/);
    expect(headline).toMatch(/font-family:\s*var\(--auth-display\)/);
  });

  it('sets fields as 15px semibold labels over 48px inputs with an 8px radius and 16px text', () => {
    expect(rule('.auth-field__label')).toMatch(/font-size:\s*calc\(15px \* var\(--type-scale\)\)[\s\S]*font-weight:\s*600/);
    const input = rule('.auth-input');
    expect(input).toMatch(/height:\s*48px/);
    expect(input).toMatch(/border:\s*1px solid var\(--color-border-strong\)/);
    expect(input).toMatch(/border-radius:\s*var\(--radius-sm\)/);
    expect(input).toMatch(/font-size:\s*calc\(16px \* var\(--type-scale\)\)/);
  });

  it('focus is a 2px primary border inside a white and primary double ring', () => {
    const focus = rule('.auth-input:focus,\n.auth-input:focus-visible');
    expect(focus).toMatch(/border:\s*2px solid var\(--color-primary\)/);
    expect(focus).toMatch(/0 0 0 2px var\(--color-surface\)/);
    expect(focus).toMatch(/0 0 0 5px var\(--color-primary\)/);
  });

  it('draws the card at 16px radius with a border and the soft shadow', () => {
    const at = css.indexOf('.auth-split__main > .auth-body {');
    expect(at).toBeGreaterThan(-1);
    const card = css.slice(at, css.indexOf('}', at));
    expect(card).toMatch(/width:\s*400px/);
    expect(card).toMatch(/padding:\s*32px/);
    expect(card).toMatch(/border-radius:\s*var\(--radius-lg\)/);
    expect(card).toMatch(/box-shadow:\s*var\(--auth-card-shadow\)/);
  });

  it('keeps the forgot link at the end of its row, pulled up 12px, with a 44px target', () => {
    expect(rule('.auth-forgot')).toMatch(/justify-content:\s*flex-end[\s\S]*margin-top:\s*-12px/);
    expect(rule('.auth-link')).toMatch(/min-height:\s*var\(--touch-target\)/);
  });

  it('colours the meter segments red, amber, blue, green in order', () => {
    expect(css).toMatch(/nth-child\(1\)\s*{\s*background:\s*var\(--color-danger\)/);
    expect(css).toMatch(/nth-child\(2\)\s*{\s*background:\s*var\(--color-warning\)/);
    expect(css).toMatch(/nth-child\(3\)\s*{\s*background:\s*var\(--color-info\)/);
    expect(css).toMatch(/nth-child\(4\)\s*{\s*background:\s*var\(--color-success\)/);
  });

  it('pins the sign up submit in a sticky bar on mobile and releases it from 600px', () => {
    const bar = rule('.auth-sticky');
    expect(bar).toMatch(/position:\s*sticky/);
    expect(bar).toMatch(/bottom:\s*0/);
    expect(bar).toMatch(/margin:\s*auto -20px -28px/);
    expect(bar).toMatch(/padding:\s*12px 20px 20px/);
    expect(css.slice(css.lastIndexOf('@media (min-width: 600px)'))).toMatch(/position:\s*static/);
  });

  it('scales every font size with the theme type scale', () => {
    expect(css).not.toMatch(/font-size:\s*\d+px/);
  });

  it('stops the spinner for reduced motion', () => {
    expect(css).toMatch(/prefers-reduced-motion: reduce\)\s*{\s*\.auth-spinner\s*{\s*animation:\s*none/);
  });
});
