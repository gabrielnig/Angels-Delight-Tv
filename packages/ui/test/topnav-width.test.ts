import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { createElement, Fragment } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Icon } from '../src/components/Icon';
import { BottomTabBar, TopNav } from '../src/components/TopNav';
import { repoRoot } from './css-scan';

/**
 * L12 width stress test (S184). The real stylesheet is loaded in Chromium at 320, 360 and 414 wide with long
 * Yoruba, Igbo and Hausa brand and Kids labels, and every state of the phone header is measured: no horizontal
 * overflow, no control outside the screen, no two controls overlapping, no wrapped label, 44 px targets.
 * Skips where no Chromium is installed.
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

const NAMES = {
  yoruba: 'Ile Ikekoo Fidio Awon Angeli Alayo Ti Orile Ede Naijiria',
  igbo: 'Ulo Akwukwo Vidiyo Ndi Mmuo Ozi Obi Uto Nke Naijiria',
  hausa: 'Gidan Talabijin Din Koyarwa Na Mala Ikan Allah Nijeriya',
};
const KIDS = { yoruba: 'Omode ati odo kekere', igbo: 'Umuaka na ndi nta', hausa: 'Yara kanana' };

const links = [
  { label: 'Home', href: '/' },
  { label: 'Browse', href: '/browse' },
];

const stub = (label: string, extra = '') =>
  createElement(
    'a',
    {
      href: '#',
      className: 'ad-iconbtn',
      'aria-label': label,
      'data-variant': 'plain',
      ...(extra ? { 'data-x': extra } : {}),
    },
    createElement(Icon, { name: 'search', size: 24 }),
  );

interface Variant {
  name: string;
  props: (lang: keyof typeof NAMES) => Record<string, unknown>;
}

const variants: Variant[] = [
  { name: 'guest', props: (l) => ({ guest: true, brand: { name: NAMES[l], href: '/' } }) },
  {
    name: 'signed in with bell and language picker',
    props: (l) => ({
      brand: { name: NAMES[l], href: '/' },
      hasBell: true,
      trailing: createElement(
        Fragment,
        null,
        stub('Language', 'lang'),
        stub('Notifications', 'bell'),
      ),
    }),
  },
  {
    name: 'signed in without bell',
    props: (l) => ({ brand: { name: NAMES[l], href: '/' }, profileName: 'Adaobi Chukwuemeka' }),
  },
  {
    name: 'kids profile',
    props: (l) => ({ kids: true, kidsLabel: KIDS[l], brand: { name: NAMES[l], href: '/' } }),
  },
  {
    name: 'kids mode guest',
    props: (l) => ({
      guest: true,
      kids: true,
      kidsLabel: KIDS[l],
      brand: { name: NAMES[l], href: '/' },
    }),
  },
];

const SCRIPT = `() => {
  const bar = document.querySelector('.ad-nav');
  const controls = [...bar.querySelectorAll('.ad-nav__brand, .ad-nav__kids, .ad-nav__tools a, .ad-nav__tools button')]
    .filter((el) => el.getClientRects().length > 0);
  const rect = (el) => { const r = el.getBoundingClientRect(); return { l: r.left, r: r.right, t: r.top, b: r.bottom, w: r.width, h: r.height, name: el.getAttribute('aria-label') || el.className }; };
  const rects = controls.map(rect);
  const overlaps = [];
  for (let i = 0; i < rects.length; i++) for (let j = i + 1; j < rects.length; j++) {
    const a = rects[i], b = rects[j];
    if (a.l < b.r - 0.5 && b.l < a.r - 0.5 && a.t < b.b - 0.5 && b.t < a.b - 0.5) overlaps.push(a.name + ' / ' + b.name);
  }
  const labels = [...bar.querySelectorAll('.ad-nav__name, .ad-nav__kids')].filter((el) => el.getClientRects().length > 0);
  const wrapped = labels.filter((el) => el.getClientRects().length > 1 || el.getBoundingClientRect().height > parseFloat(getComputedStyle(el).lineHeight || '0') * 1.6 + 8).map((el) => el.className);
  const nameEl = bar.querySelector('.ad-nav__name');
  return {
    docWidth: document.documentElement.scrollWidth,
    view: window.innerWidth,
    offscreen: rects.filter((r) => r.l < -0.5 || r.r > window.innerWidth + 0.5).map((r) => r.name),
    overlaps,
    small: rects.filter((r) => !/ad-nav__kids/.test(r.name) && (r.h < 43.5 || r.w < 43.5)).map((r) => r.name + ' ' + Math.round(r.w) + 'x' + Math.round(r.h)),
    wrapped,
    barHeight: bar.getBoundingClientRect().height,
    nameHidden: nameEl ? getComputedStyle(nameEl).display === 'none' : true,
    count: rects.length,
  };
}`;

interface Result {
  docWidth: number;
  view: number;
  offscreen: string[];
  overlaps: string[];
  small: string[];
  wrapped: string[];
  barHeight: number;
  nameHidden: boolean;
  count: number;
}

describe.skipIf(!chromium)('phone header width stress (L12, S184)', () => {
  it('has no overflow, overlap, wrapped label or small target at 320, 360 and 414', async () => {
    const { chromium: browserType } = await import('@playwright/test');
    const browser = await browserType.launch({ executablePath: chromium, args: ['--no-sandbox'] });
    const failures: string[] = [];
    try {
      for (const width of [320, 360, 414]) {
        const page = await browser.newPage({ viewport: { width, height: 700 } });
        for (const variant of variants) {
          for (const lang of Object.keys(NAMES) as Array<keyof typeof NAMES>) {
            const html = renderToStaticMarkup(
              createElement(TopNav, {
                brand: { name: NAMES[lang], href: '/' },
                links,
                currentPath: '/browse',
                profileName: 'Ada',
                menu: [],
                ...variant.props(lang),
              } as never),
            );
            await page.setContent(
              `<!doctype html><html><head><meta charset="utf-8"><style>${tokens}\n${components}\nbody{margin:0;font-family:Arial,sans-serif}</style></head><body>${html}<main style="height:900px"></main></body></html>`,
            );
            const r = (await page.evaluate(`(${SCRIPT})()`)) as Result;
            const tag = `${width} ${variant.name} ${lang}`;
            if (r.docWidth > r.view)
              failures.push(`${tag}: horizontal overflow ${r.docWidth} > ${r.view}`);
            if (r.offscreen.length) failures.push(`${tag}: off screen ${r.offscreen.join(', ')}`);
            if (r.overlaps.length) failures.push(`${tag}: overlap ${r.overlaps.join('; ')}`);
            if (r.small.length) failures.push(`${tag}: under 44 ${r.small.join(', ')}`);
            if (r.wrapped.length) failures.push(`${tag}: wrapped ${r.wrapped.join(', ')}`);
            if (width <= 339 && !r.nameHidden) failures.push(`${tag}: name still shown under 340`);
          }
        }
        await page.close();
      }
    } finally {
      await browser.close();
    }
    expect(failures).toEqual([]);
  }, 120_000);
});

const TABS = {
  yoruba: ['Ilé ìkínni', 'Ṣàwárí fídíò', 'Wá àwọn fídíò', 'Àtòkọ àwọn fídíò mi'],
  igbo: ['Ụlọ mbụ', 'Chọgharịa vidiyo', 'Chọọ vidiyo ndị ọzọ', 'Ndepụta vidiyo m niile'],
  hausa: ['Gida', 'Bincika bidiyo', 'Nemo bidiyoyi', 'Jerin bidiyona na kaina'],
};
const ICONS = ['home', 'grid', 'search', 'list'] as const;

const TAB_SCRIPT = `() => {
  const bar = document.querySelector('.ad-tabbar');
  const items = [...bar.querySelectorAll('.ad-tabbar__item')];
  const rects = items.map((el) => { const r = el.getBoundingClientRect(); return { l: r.left, r: r.right, t: r.top, b: r.bottom, w: r.width, h: r.height }; });
  const overlaps = [];
  for (let i = 0; i < rects.length; i++) for (let j = i + 1; j < rects.length; j++) {
    const a = rects[i], b = rects[j];
    if (a.l < b.r - 0.5 && b.l < a.r - 0.5 && a.t < b.b - 0.5 && b.t < a.b - 0.5) overlaps.push(i + '/' + j);
  }
  const labels = items.map((el) => el.querySelector('span'));
  const wrapped = labels.filter((el) => el.getClientRects().length > 1 || el.getBoundingClientRect().height > parseFloat(getComputedStyle(el).lineHeight || '0') * 1.6 + 8).length;
  const spill = labels.filter((el, i) => { const r = el.getBoundingClientRect(); return r.left < rects[i].l - 0.5 || r.right > rects[i].r + 0.5; }).length;
  return {
    docWidth: document.documentElement.scrollWidth, view: window.innerWidth,
    offscreen: rects.filter((r) => r.l < -0.5 || r.r > window.innerWidth + 0.5).length,
    overlaps, wrapped, spill,
    small: rects.filter((r) => r.h < 43.5 || r.w < 43.5).length,
    barHeight: bar.getBoundingClientRect().height,
  };
}`;

describe.skipIf(!chromium)('tab bar width stress (L12, S184, S185)', () => {
  it('clips long labels without overflow, overlap or wrapping at 320, 360, 414 and in landscape', async () => {
    const { chromium: browserType } = await import('@playwright/test');
    const browser = await browserType.launch({ executablePath: chromium, args: ['--no-sandbox'] });
    const failures: string[] = [];
    try {
      const sizes = [
        { width: 320, height: 640 },
        { width: 360, height: 740 },
        { width: 414, height: 800 },
        { width: 667, height: 375 },
      ];
      for (const size of sizes) {
        const page = await browser.newPage({ viewport: size });
        for (const lang of Object.keys(TABS) as Array<keyof typeof TABS>) {
          const html = renderToStaticMarkup(
            createElement(BottomTabBar, {
              currentPath: '/browse',
              tabs: TABS[lang].map((label, i) => ({
                label,
                href: ['/', '/browse', '/search', '/my-list'][i]!,
                icon: ICONS[i]!,
              })),
            }),
          );
          await page.setContent(
            `<!doctype html><html><head><meta charset="utf-8"><style>${tokens}\n${components}\nbody{margin:0;font-family:Arial,sans-serif}</style></head><body>${html}</body></html>`,
          );
          const r = (await page.evaluate(`(${TAB_SCRIPT})()`)) as {
            docWidth: number;
            view: number;
            offscreen: number;
            overlaps: string[];
            wrapped: number;
            spill: number;
            small: number;
            barHeight: number;
          };
          const tag = `${size.width}x${size.height} ${lang}`;
          if (r.docWidth > r.view) failures.push(`${tag}: horizontal overflow`);
          if (r.offscreen) failures.push(`${tag}: item off screen`);
          if (r.overlaps.length) failures.push(`${tag}: overlap ${r.overlaps.join(',')}`);
          if (r.wrapped) failures.push(`${tag}: ${r.wrapped} labels wrapped`);
          if (r.spill) failures.push(`${tag}: ${r.spill} labels spill out of their tab`);
          if (r.small) failures.push(`${tag}: ${r.small} tabs under 44`);
          if (size.height === 375 && r.barHeight > 45.5)
            failures.push(`${tag}: landscape bar ${r.barHeight} tall`);
        }
        await page.close();
      }
    } finally {
      await browser.close();
    }
    expect(failures).toEqual([]);
  }, 120_000);
});
