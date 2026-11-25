import { renderToStaticMarkup } from 'react-dom/server';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Browser } from '@playwright/test';
import { findChromium, launch, openAt, pageCss } from '../../test/layout-browser';
import { CategoryRail, type RailItem } from './CategoryRail';

const names = [
  'All',
  'Science',
  'Maths',
  'English',
  'Life Skills',
  'Geography',
  'Health',
  'Digital',
  'Nature',
  'Stories',
  'Songs',
  'Ogbon ati imo sayensi fun gbogbo eniyan',
];
const items: RailItem[] = names.map((label, i) => ({
  href: i === 0 ? '/browse' : `/browse/${label.toLowerCase().replace(/\s+/g, '-')}`,
  label,
  current: i === 4,
}));

const WIDTHS = [320, 360, 414, 1360];
const chrome = findChromium();

describe.skipIf(!chrome)('CategoryRail measured layout (L11 slice 1)', () => {
  let browser: Browser;
  beforeAll(async () => {
    browser = await launch();
  });
  afterAll(async () => {
    await browser?.close();
  });

  const body = () =>
    `<main class="web-page"><h1>Browse</h1>${renderToStaticMarkup(
      <CategoryRail label="Categories" items={items} />,
    )}</main>`;
  const css = () => pageCss(['apps/web/src/components/browse/browse-rail.css']);

  for (const width of WIDTHS) {
    it(`never wraps and never overflows the page at ${width}px`, async () => {
      const page = await openAt(browser, width, body(), css());
      const m = await page.evaluate(() => {
        const tops = [...document.querySelectorAll<HTMLElement>('.web-rail__item')].map(
          (el) => Math.round(el.getBoundingClientRect().top),
        );
        const scroller = document.querySelector<HTMLElement>('.web-rail__scroller')!;
        const doc = document.documentElement;
        return {
          rows: new Set(tops).size,
          pageOverflow: doc.scrollWidth - doc.clientWidth,
          scrolls: scroller.scrollWidth > scroller.clientWidth,
          flexWrap: getComputedStyle(scroller).flexWrap,
          snap: getComputedStyle(scroller).scrollSnapType,
          targets: [...document.querySelectorAll<HTMLElement>('.web-rail__link')].map((el) => {
            const r = el.getBoundingClientRect();
            return [Math.round(r.width), Math.round(r.height)];
          }),
        };
      });
      await page.close();
      expect(m.rows).toBe(1);
      expect(m.flexWrap).toBe('nowrap');
      expect(m.snap).toContain('x');
      expect(m.pageOverflow).toBeLessThanOrEqual(0);
      expect(m.scrolls).toBe(true);
      for (const [w, h] of m.targets) {
        expect(w).toBeGreaterThanOrEqual(44);
        expect(h).toBeGreaterThanOrEqual(44);
      }
    });
  }

  it('shows the arrows on a fine pointer only', async () => {
    const page = await openAt(browser, 1360, body(), css());
    // Force the end state the component sets once measured.
    await page.evaluate(() => document.querySelector('.web-rail')!.classList.add('can-end'));
    const fine = await page.evaluate(
      () => getComputedStyle(document.querySelector('.web-rail__arrow--end')!).display,
    );
    await page.close();
    const phone = await browser.newContext({ viewport: { width: 390, height: 800 }, hasTouch: true, isMobile: true });
    const touch = await phone.newPage();
    await touch.setContent(
      `<!doctype html><html><head><meta name="viewport" content="width=device-width"><style>${css()}</style></head><body>${body()}</body></html>`,
    );
    await touch.evaluate(() => document.querySelector('.web-rail')!.classList.add('can-end'));
    const coarse = await touch.evaluate(
      () => getComputedStyle(document.querySelector('.web-rail__arrow--end')!).display,
    );
    await phone.close();
    expect(fine).toBe('flex');
    expect(coarse).toBe('none');
  });
});
