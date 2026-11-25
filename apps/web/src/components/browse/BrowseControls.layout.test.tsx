import { renderToStaticMarkup } from 'react-dom/server';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { Browser } from '@playwright/test';
import { msg } from '@ad/shared/messages';
import { findChromium, launch, openAt, pageCss } from '../../test/layout-browser';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: () => {} }) }));

import { BrowseControls } from './BrowseControls';
import { lengthOptions, sortOptions } from './browse-options';

const railItems = ['All', 'Science', 'Maths', 'English', 'Life Skills', 'Geography', 'Health'].map(
  (label, i) => ({ href: `/browse/${i}`, label, current: i === 0 }),
);
const WIDTHS = [320, 360, 414, 1360];
const chrome = findChromium();

describe.skipIf(!chrome)('BrowseControls measured layout (L11 slice 2)', () => {
  let browser: Browser;
  beforeAll(async () => {
    browser = await launch();
  });
  afterAll(async () => {
    await browser?.close();
  });

  const css = () =>
    pageCss([
      'apps/web/src/components/browse/browse-rail.css',
      'apps/web/src/components/browse/browse-controls.css',
    ]);
  const body = (length: 'any' | 'medium' | 'long', sort: 'newest' | 'shortest' | 'az') =>
    `<main class="web-page"><h1>Browse</h1>${renderToStaticMarkup(
      <BrowseControls
        base="/browse"
        length={length}
        sort={sort}
        railLabel="Categories"
        railItems={railItems}
        lengthOptions={lengthOptions(msg)}
        sortOptions={sortOptions(msg)}
      />,
    )}<div style="height:3000px">grid</div></main>`;

  for (const width of WIDTHS) {
    for (const [length, sort] of [
      ['any', 'newest'],
      ['medium', 'shortest'],
      ['long', 'az'],
    ] as const) {
      it(`bar stays on one row, keeps its values whole and never overflows the page at ${width}px with ${length} and ${sort} set`, async () => {
        const page = await openAt(browser, width, body(length, sort), css());
        const m = await page.evaluate(() => {
          const bar = document.querySelector<HTMLElement>('.web-browse-bar')!;
          const doc = document.documentElement;
          const kids = [...bar.children].map((el) => el.getBoundingClientRect());
          const first = kids[0]!;
          return {
            pageOverflow: doc.scrollWidth - doc.clientWidth,
            barOverflow: bar.scrollWidth - bar.clientWidth,
            oneRow: kids.every((r) => Math.abs(r.top - first.top) < 4),
            targets: [...bar.querySelectorAll<HTMLElement>('button, a')].map((el) => {
              const r = el.getBoundingClientRect();
              return Math.round(r.height);
            }),
            gaps: kids.slice(1).map((r, i) => Math.round(r.left - kids[i]!.right)),
          };
        });
        const trunc = await page.evaluate(() => [...document.querySelectorAll<HTMLElement>('.web-menu__value')].map((el) => el.scrollWidth - el.clientWidth));
        await page.close();
        expect(trunc.every((t) => t <= 0), `truncated values ${trunc}`).toBe(true);
        expect(m.pageOverflow).toBeLessThanOrEqual(0);
        // Phones scroll the bar sideways by design. From 600 px up it must fit.
        if (width >= 600) expect(m.barOverflow).toBeLessThanOrEqual(0);
        expect(m.oneRow).toBe(true);
        for (const h of m.targets) expect(h).toBeGreaterThanOrEqual(44);
        for (const g of m.gaps) expect(g).toBeGreaterThanOrEqual(8);
      });
    }
  }

  it('pins the rail under the nav and lets the bar hang below it', async () => {
    const page = await openAt(browser, 390, body('any', 'newest'), css());
    await page.evaluate(() => window.scrollTo(0, 600));
    const m = await page.evaluate(() => {
      const stack = document.querySelector<HTMLElement>('.web-browse-stack')!;
      const bar = document.querySelector<HTMLElement>('.web-browse-bar')!;
      const navHeight = parseFloat(getComputedStyle(stack).top);
      return {
        stackTop: Math.round(stack.getBoundingClientRect().top),
        navHeight: Math.round(navHeight),
        barTop: Math.round(bar.getBoundingClientRect().top),
        stackBottom: Math.round(stack.getBoundingClientRect().bottom),
      };
    });
    await page.close();
    expect(m.stackTop).toBe(m.navHeight);
    expect(m.barTop).toBe(m.stackBottom);
  });

  it('a hidden bar leaves the rail where it was and cannot be tabbed to', async () => {
    const page = await openAt(browser, 390, body('any', 'newest'), css());
    await page.evaluate(() => window.scrollTo(0, 600));
    const before = await page.evaluate(
      () => Math.round(document.querySelector('.web-browse-stack')!.getBoundingClientRect().height),
    );
    await page.evaluate(() =>
      document.querySelector('.web-browse-bar')!.setAttribute('data-hidden', 'true'),
    );
    await page.waitForTimeout(400);
    const m = await page.evaluate(() => {
      const bar = document.querySelector<HTMLElement>('.web-browse-bar')!;
      return {
        stackHeight: Math.round(document.querySelector('.web-browse-stack')!.getBoundingClientRect().height),
        visibility: getComputedStyle(bar).visibility,
        opacity: getComputedStyle(bar).opacity,
      };
    });
    await page.close();
    expect(m.stackHeight).toBe(before);
    expect(m.visibility).toBe('hidden');
    expect(m.opacity).toBe('0');
  });
});
