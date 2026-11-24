import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Hero, type HeroItem } from '../src/components/Hero';
import { repoRoot } from './css-scan';

/**
 * R36 text zone measurement. The real stylesheet is loaded in Chromium at 360, 390 and 1360 wide, the geometry of
 * every text run in the hero is measured, and the scrim stops Chromium resolved are walked at those positions
 * with bright art (pure white, near white and warm white) behind them. White text must keep 4.5 to 1 on each and
 * the scrim alpha must stay above 0.57 in the title zone. Skips where no Chromium is installed.
 */

function findChromium(): string | undefined {
  const fromEnv = process.env.E2E_CHROMIUM_PATH;
  if (fromEnv && existsSync(fromEnv)) return fromEnv;
  const base = process.env.PLAYWRIGHT_BROWSERS_PATH ?? '/opt/pw-browsers';
  if (!existsSync(base)) return undefined;
  const dirs = readdirSync(base)
    .filter((name) => /^chromium-\d+$/.test(name))
    .sort()
    .reverse();
  for (const dir of dirs) {
    const path = resolve(base, dir, 'chrome-linux64/chrome');
    if (existsSync(path)) return path;
  }
  return undefined;
}

const chromium = findChromium();
const tokens = readFileSync(resolve(repoRoot, 'packages/ui/src/tokens.css'), 'utf8');
const components = readFileSync(resolve(repoRoot, 'packages/ui/src/components.css'), 'utf8');

const item: HeroItem = {
  id: 'a',
  title: 'How Plants Make Their Own Food',
  meta: 'Science, 6 min',
  description:
    'A short, clear lesson on photosynthesis with simple drawings, so every learner can follow along and try it at home.',
  playHref: '/watch/a',
  infoHref: '/title/a',
};

const ARTS = ['#FFFFFF', '#F5F5F5', '#F3EBD0'];

interface Measure {
  width: number;
  text: { top?: number; bottom?: number; h?: number; name: string; contrast: number; alpha: number; title: boolean }[];
}

const SCRIPT = `(arts) => {
  const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
  const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const slide = document.querySelector('.ad-hero__slide');
  const box = slide.getBoundingClientRect();
  const bg = getComputedStyle(document.querySelector('.ad-hero__scrim')).backgroundImage;
  const layers = [];
  let depth = 0, start = 0;
  for (let i = 0; i <= bg.length; i++) {
    const ch = bg[i];
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if ((ch === ',' && depth === 0) || i === bg.length) { layers.push(bg.slice(start, i).trim()); start = i + 1; }
  }
  const parsed = layers.map((layer) => {
    const inner = layer.slice(layer.indexOf('(') + 1, layer.lastIndexOf(')'));
    const dm = /^to (top|right|bottom|left)/.exec(inner);
    const dir = dm ? dm[1] : 'bottom';
    const stops = [...inner.matchAll(/rgba?\\(([^)]+)\\)\\s*([\\d.]+)%/g)].map((m) => {
      const p = m[1].split(',').map(Number);
      return { rgb: p.slice(0, 3), a: p.length > 3 ? p[3] : 1, at: Number(m[2]) / 100 };
    });
    return { dir, stops };
  });
  const alphaAt = (layer, x, y) => {
    const t = layer.dir === 'top' ? (box.height - y) / box.height : layer.dir === 'bottom' ? y / box.height : layer.dir === 'right' ? x / box.width : (box.width - x) / box.width;
    const s = layer.stops;
    if (t <= s[0].at) return s[0].a;
    for (let i = 1; i < s.length; i++) if (t <= s[i].at) return s[i - 1].a + (s[i].a - s[i - 1].a) * ((t - s[i - 1].at) / (s[i].at - s[i - 1].at));
    return s[s.length - 1].a;
  };
  const targets = [['title', '.ad-hero__title', true], ['meta', '.ad-hero__meta', true], ['text', '.ad-hero__text', false]];
  const out = [];
  for (const [name, sel, title] of targets) {
    const el = document.querySelector(sel);
    const range = document.createRange();
    range.selectNodeContents(el);
    const rects = [...range.getClientRects()].filter((r) => r.width > 0);
    const ink = (getComputedStyle(el).color.match(/\\d+/g) || [255, 255, 255]).slice(0, 3).map(Number);
    let worstContrast = 99, minAlpha = 1;
    for (const r of rects) {
      for (const [px, py] of [[r.left, r.top], [r.right, r.top], [r.left, r.bottom], [r.right, r.bottom], [(r.left + r.right) / 2, (r.top + r.bottom) / 2]]) {
        const x = px - box.left, y = py - box.top;
        const alphas = parsed.map((l) => alphaAt(l, x, y));
        let total = 1;
        for (const a of alphas) total *= 1 - a;
        minAlpha = Math.min(minAlpha, 1 - total);
        for (const art of arts) {
          let color = hex(art);
          for (let i = parsed.length - 1; i >= 0; i--) {
            const a = alphas[i];
            const rgb = parsed[i].stops[0].rgb;
            color = color.map((v, k) => v * (1 - a) + rgb[k] * a);
          }
          worstContrast = Math.min(worstContrast, ratio(ink, color));
        }
      }
    }
    out.push({ name, contrast: worstContrast, alpha: minAlpha, title, top: rects[0].top - box.top, bottom: rects[rects.length-1].bottom - box.top, h: box.height });
  }
  return { width: box.width, text: out };
}`;

async function measure(width: number): Promise<Measure> {
  const { chromium: browserType } = await import('@playwright/test');
  const browser = await browserType.launch({ executablePath: chromium, args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    const html = renderToStaticMarkup(createElement(Hero, { items: [item], label: 'Featured' }));
    await page.setContent(
      `<!doctype html><html><head><meta charset="utf-8"><style>${tokens}\n${components}\nbody{margin:0;font-family:Arial,sans-serif}</style></head><body>${html}</body></html>`,
    );
    return (await page.evaluate(`(${SCRIPT})(${JSON.stringify(ARTS)})`)) as Measure;
  } finally {
    await browser.close();
  }
}

describe.skipIf(!chromium)('hero text zone over bright art (R36)', () => {
  for (const width of [360, 390, 1360]) {
    it(`keeps white text at 4.5 to 1 and alpha above 0.57 at ${width} wide`, async () => {
      const result = await measure(width);
      if (process.env.HERO_DEBUG) console.log(width, JSON.stringify(result));
      for (const run of result.text) {
        expect(run.contrast, `${run.name} contrast at ${width}`).toBeGreaterThanOrEqual(4.5);
        expect(run.alpha, `${run.name} alpha at ${width}`).toBeGreaterThan(0.57);
      }
    }, 60_000);
  }
});
