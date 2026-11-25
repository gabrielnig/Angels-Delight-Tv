import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { TopNav } from '../src/components/TopNav';
import { repoRoot } from './css-scan';

/**
 * L12 scrim measurement (D-381). The clear bar sits over pure white, cream and pale lemon art. The scrim layer
 * Chromium resolved is walked along the bar and just below it: the alpha must hold 0.85 to the bottom of the bar and
 * white icons and text must keep 4.5 to 1 there. Skips where no Chromium is installed.
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

const SCRIPT = `() => {
  const bar = document.querySelector('.ad-nav');
  const barH = bar.getBoundingClientRect().height;
  const cs = getComputedStyle(bar, '::after');
  const layerH = parseFloat(cs.height);
  const bg = cs.backgroundImage;
  const position = (text) => {
    const calc = /calc\\(100% - ([\\d.]+)px\\)/.exec(text);
    if (calc) return layerH - Number(calc[1]);
    const m = /([\\d.]+)(px|%)/.exec(text);
    return m[2] === 'px' ? Number(m[1]) : (Number(m[1]) / 100) * layerH;
  };
  const stops = [...bg.matchAll(/rgba?\\(([^)]+)\\)\\s*(calc\\([^)]*\\)|[\\d.]+(?:px|%))/g)].map((m) => {
    const p = m[1].split(',').map(Number);
    return { a: p.length > 3 ? p[3] : 1, at: position(m[2]) };
  });
  const alphaAt = (y) => {
    if (y <= stops[0].at) return stops[0].a;
    for (let i = 1; i < stops.length; i++) if (y <= stops[i].at) return stops[i - 1].a + (stops[i].a - stops[i - 1].a) * ((y - stops[i - 1].at) / (stops[i].at - stops[i - 1].at));
    return stops[stops.length - 1].a;
  };
  return { barH, layerH, bg, a: [0, barH * 0.5, barH * 0.9, barH].map(alphaAt), end: alphaAt(layerH) };
}`;

describe.skipIf(!chromium)('nav scrim over pale art (D-381)', () => {
  for (const width of [360, 414]) {
    it(`holds 0.85 through the whole bar and keeps white at 4.5 to 1 over white art at ${width} wide`, async () => {
      const { chromium: browserType } = await import('@playwright/test');
      const browser = await browserType.launch({
        executablePath: chromium,
        args: ['--no-sandbox'],
      });
      try {
        const page = await browser.newPage({ viewport: { width, height: 700 } });
        const html = renderToStaticMarkup(
          createElement(TopNav, {
            brand: { name: 'Angels Delight TV', href: '/' },
            links: [],
            currentPath: '/',
            profileName: 'Ada',
            menu: [],
            overHero: true,
          }),
        );
        await page.setContent(
          `<!doctype html><html><head><meta charset="utf-8"><style>${tokens}\n${components}\nbody{margin:0;background:#fff;font-family:Arial,sans-serif}</style></head><body>${html}<main style="height:900px"></main></body></html>`,
        );
        const r = (await page.evaluate(`(${SCRIPT})()`)) as {
          barH: number;
          layerH: number;
          bg: string;
          a: number[];
          end: number;
        };
        // The layer reaches the fade token (16 px) below the bar.
        expect(r.layerH).toBeCloseTo(r.barH + 16, 0);
        for (const alpha of r.a) expect(alpha, r.bg).toBeGreaterThanOrEqual(0.85 - 1e-6);
        expect(r.end).toBe(0);
        // White on ink 14,15,19 at 0.85 over white art.
        const channel = (v: number) => {
          const c = v / 255;
          return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
        };
        const lum = (rgb: number[]) =>
          0.2126 * channel(rgb[0]!) + 0.7152 * channel(rgb[1]!) + 0.0722 * channel(rgb[2]!);
        const alpha = Math.min(...r.a);
        const composite = [14, 15, 19].map((v) => v * alpha + 255 * (1 - alpha));
        const ratio = (1 + 0.05) / (lum(composite) + 0.05);
        expect(ratio).toBeGreaterThanOrEqual(4.5);
      } finally {
        await browser.close();
      }
    }, 60_000);
  }
});
