import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * M45-S11 / DESIGN-SYSTEM 11.13: the storage notice and a toast must never overlap. jsdom has no layout, so this
 * reads the real stylesheets, picks the rules that apply at a viewport width and computes both rectangles. The
 * notice height is a run time value (it wraps), so every height from one line to a tall wrapped notice is tried.
 */
const UI = resolve(__dirname, '../../../../../packages/ui/src');
const read = (file: string) => readFileSync(file, 'utf8');
const tokensCss = read(resolve(UI, 'tokens.css'));
const componentsCss = read(resolve(UI, 'components.css'));
const noticeCss = read(resolve(__dirname, 'consent.css'));

interface Rule {
  minWidth: number;
  selector: string;
  decls: Record<string, string>;
}

function parse(css: string): Rule[] {
  const out: Rule[] = [];
  const text = css.replace(/\/\*[\s\S]*?\*\//g, '');
  function block(from: number): number {
    let depth = 1;
    let i = from;
    while (i < text.length && depth > 0) {
      if (text[i] === '{') depth += 1;
      else if (text[i] === '}') depth -= 1;
      i += 1;
    }
    return i;
  }
  function walk(start: number, end: number, minWidth: number) {
    let i = start;
    while (i < end) {
      const open = text.indexOf('{', i);
      if (open === -1 || open >= end) return;
      const head = text.slice(i, open).trim();
      const close = block(open + 1);
      const inner = text.slice(open + 1, close - 1);
      if (head.startsWith('@')) {
        const m = /^@media\s*\(min-width:\s*(\d+)px\)\s*$/.exec(head);
        if (m) walk(open + 1, close - 1, Number(m[1]));
      } else {
        const decls: Record<string, string> = {};
        for (const part of inner.split(';')) {
          const idx = part.indexOf(':');
          if (idx > 0) decls[part.slice(0, idx).trim()] = part.slice(idx + 1).trim();
        }
        for (const selector of head.split(',')) out.push({ minWidth, selector: selector.trim(), decls });
      }
      i = close;
    }
  }
  walk(0, text.length, 0);
  return out;
}

const tokens: Record<string, string> = {};
for (const m of tokensCss.matchAll(/(--[a-z0-9-]+):\s*([^;]+);/g)) {
  if (!(m[1]! in tokens)) tokens[m[1]!] = m[2]!.replace(/\/\*.*$/, '').trim();
}

function styleAt(rules: Rule[], selector: string, width: number): Record<string, string> {
  const merged: Record<string, string> = {};
  for (const rule of rules) {
    if (rule.selector === selector && rule.minWidth <= width) Object.assign(merged, rule.decls);
  }
  return merged;
}

// A tiny length evaluator: px, rem, vw, var(), env(), calc with + and -, min().
function evaluate(expr: string, ctx: { vw: number; h: number; parent?: number }): number {
  let i = 0;
  const src = expr.replace(/\s+/g, ' ').trim();
  function ws() {
    while (src[i] === ' ') i += 1;
  }
  function term(): number {
    ws();
    if (src.startsWith('calc(', i)) {
      i += 5;
      const v = sum();
      i += 1;
      return v;
    }
    if (src.startsWith('min(', i)) {
      i += 4;
      const first = sum();
      ws();
      i += 1;
      const second = sum();
      i += 1;
      return Math.min(first, second);
    }
    if (src.startsWith('env(', i)) {
      i = src.indexOf(')', i) + 1;
      return 0;
    }
    if (src.startsWith('var(', i)) {
      const end = src.indexOf(')', i);
      let depth = 0;
      let j = i;
      for (; j < src.length; j += 1) {
        if (src[j] === '(') depth += 1;
        if (src[j] === ')') {
          depth -= 1;
          if (depth === 0) break;
        }
      }
      void end;
      const inner = src.slice(i + 4, j);
      i = j + 1;
      const comma = inner.indexOf(',');
      const name = (comma === -1 ? inner : inner.slice(0, comma)).trim();
      if (name === '--notice-h') return ctx.h;
      const raw = tokens[name] ?? (comma === -1 ? undefined : inner.slice(comma + 1).trim());
      if (raw === undefined) throw new Error(`unknown token ${name}`);
      return evaluate(raw, ctx);
    }
    const m = /^(-?\d*\.?\d+)(px|rem|vw|%)?/.exec(src.slice(i));
    if (!m) throw new Error(`cannot read "${src.slice(i)}" in "${expr}"`);
    i += m[0].length;
    const n = Number(m[1]);
    if (m[2] === 'rem') return n * 16;
    if (m[2] === 'vw') return (n * ctx.vw) / 100;
    if (m[2] === '%') return ((ctx.parent ?? 0) * n) / 100;
    return n;
  }
  function sum(): number {
    let v = term();
    for (;;) {
      ws();
      if (src[i] === '+') {
        i += 1;
        v += term();
      } else if (src[i] === '-') {
        i += 1;
        v -= term();
      } else return v;
    }
  }
  return sum();
}

const noticeRules = parse(noticeCss);
const uiRules = parse(componentsCss);

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

const TOAST_HEIGHT = 56;
const SCREEN_HEIGHT = 800;

function noticeRect(vw: number, h: number): Rect {
  const s = styleAt(noticeRules, '.ad-notice', vw);
  const ctx = { vw, h };
  const bottom = evaluate(s['bottom']!, ctx);
  const right = evaluate(s['right']!, ctx);
  let x: number;
  let w: number;
  if (s['left'] && s['left'] !== 'auto') {
    x = evaluate(s['left'], ctx);
    w = vw - x - right;
  } else {
    w = evaluate(s['width']!, ctx);
    if (s['max-width']) w = Math.min(w, evaluate(s['max-width'], ctx));
    x = vw - right - w;
  }
  return { x, y: SCREEN_HEIGHT - bottom - h, w, h };
}

function toastRect(vw: number, h: number): Rect {
  const box = styleAt(uiRules, '.ad-toasts', vw);
  const toast = styleAt(uiRules, '.ad-toast', vw);
  const ctx = { vw, h };
  const bottom = evaluate(box['bottom']!, ctx);
  const left = evaluate(box['left']!, ctx);
  const rightAuto = box['right'] === 'auto';
  const containerW = rightAuto ? 360 : vw - left - evaluate(box['right']!, ctx);
  const w = evaluate(toast['width']!.replace(/min\(100%,/, `min(${containerW}px,`), ctx);
  const x = box['justify-content'] === 'center' ? left + (containerW - w) / 2 : left;
  return { x, y: SCREEN_HEIGHT - bottom - TOAST_HEIGHT, w, h: TOAST_HEIGHT };
}

function intersects(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

describe('storage notice and toast geometry (M45-S11, DESIGN-SYSTEM 11.13)', () => {
  const widths = [360, 390, 430, 599, 600, 800, 959, 960, 1000, 1023, 1024, 1100, 1280, 1920];
  const heights = [72, 96, 120, 150, 190, 240];

  it('never overlap at any width from 360 to 1920 and any notice height', () => {
    for (const vw of widths) {
      for (const h of heights) {
        const n = noticeRect(vw, h);
        const t = toastRect(vw, h);
        expect(intersects(n, t), `${vw} wide, notice ${h} tall: ${JSON.stringify({ n, t })}`).toBe(false);
      }
    }
  });

  it('puts the notice bottom right at 1024 and wider and the toast bottom left, 176 px apart at 1024', () => {
    const n = noticeRect(1024, 120);
    const t = toastRect(1024, 120);
    expect(n.x + n.w).toBe(1024 - 24);
    expect(n.w).toBe(440);
    expect(t.x).toBe(24);
    expect(n.x - (t.x + t.w)).toBe(176);
  });

  it('lifts the toast above the notice with at least 12 px between them below 1024', () => {
    for (const vw of [390, 800, 1000]) {
      const n = noticeRect(vw, 120);
      const t = toastRect(vw, 120);
      const gap = n.y - (t.y + t.h);
      expect(gap, `${vw}`).toBeGreaterThanOrEqual(12);
      expect(gap, `${vw}`).toBeLessThanOrEqual(24);
    }
  });

  it('does not lift the toast when no notice is shown', () => {
    const base = toastRect(390, 0);
    expect(SCREEN_HEIGHT - (base.y + base.h)).toBe(72);
  });

  it('keeps the notice above the tab bar on phones and tablets', () => {
    for (const vw of [390, 800, 959]) {
      const n = noticeRect(vw, 120);
      expect(SCREEN_HEIGHT - (n.y + n.h)).toBeGreaterThanOrEqual(56 + 8);
    }
  });

  it('puts the notice on the overlay layer, below modals and toasts', () => {
    expect(styleAt(noticeRules, '.ad-notice', 1280)['z-index']).toBe('var(--z-overlay)');
    expect(tokens['--z-overlay']).toBe('30');
    expect(Number(tokens['--z-overlay'])).toBeLessThan(Number(tokens['--z-modal']));
    expect(Number(tokens['--z-modal'])).toBeLessThan(Number(tokens['--z-toast']));
  });

  it('keeps targets at 44 px and uses only tokens for colour', () => {
    expect(noticeCss).toMatch(/\.ad-notice__link[^}]*min-height:\s*44px/);
    expect(noticeCss).toMatch(/\.ad-notice__button[^}]*min-height:\s*44px/);
    expect(noticeCss).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(noticeCss).toMatch(/prefers-reduced-motion:\s*reduce/);
    expect(noticeCss).not.toMatch(/outline:\s*none/);
  });
});
