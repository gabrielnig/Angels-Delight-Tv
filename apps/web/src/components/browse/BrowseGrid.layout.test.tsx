import { renderToStaticMarkup } from 'react-dom/server';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Browser } from '@playwright/test';
import { Button, EmptyState, SkeletonCard } from '@ad/ui';
import { findChromium, launch, openAt, pageCss } from '../../test/layout-browser';
import { BrowseSkeleton } from './BrowseSkeleton';

const WIDTHS = [320, 360, 414, 1360];
const chrome = findChromium();

describe.skipIf(!chrome)('Browse grid, loading and empty states, measured (L11 slice 3)', () => {
  let browser: Browser;
  beforeAll(async () => {
    browser = await launch();
  });
  afterAll(async () => {
    await browser?.close();
  });
  const css = () => pageCss(['apps/web/src/components/browse/browse-page.css']);
  const page = (inner: string) => `<main class="web-page web-browse"><h1>Browse</h1>${inner}</main>`;
  const cards = `<ul class="web-grid">${Array.from({ length: 10 }, () => `<li>${renderToStaticMarkup(<SkeletonCard />)}</li>`).join('')}</ul>`;

  for (const width of WIDTHS) {
    it(`loading: the region holds the height and the cards fit at ${width}px`, async () => {
      // Before the shapes appear the region is empty and must already hold the height.
      const empty = await openAt(browser, width, page(renderToStaticMarkup(<BrowseSkeleton label="Loading videos" />)), css());
      const reserved = await empty.evaluate(() => ({
        height: document.querySelector<HTMLElement>('.web-browse-skeleton')!.getBoundingClientRect().height,
        view: window.innerHeight,
      }));
      await empty.close();
      expect(reserved.height).toBeGreaterThanOrEqual(reserved.view * 0.7 - 1);

      const full = await openAt(browser, width, page(cards), css());
      const m = await full.evaluate(() => {
        const doc = document.documentElement;
        const lis = [...document.querySelectorAll<HTMLElement>('.web-grid > li')];
        const columns = new Set(lis.map((li) => Math.round(li.getBoundingClientRect().left))).size;
        return { overflow: doc.scrollWidth - doc.clientWidth, columns };
      });
      await full.close();
      expect(m.overflow).toBeLessThanOrEqual(0);
      expect(m.columns).toBe(width >= 1280 ? 5 : width >= 960 ? 4 : width >= 640 ? 3 : 2);
    });

    it(`empty states fit and give one 44 px action at ${width}px`, async () => {
      const markup = page(
        renderToStaticMarkup(
          <EmptyState
            live
            icon="search"
            title="No videos match these filters"
            description="Try a different length or clear your filters."
            action={{ label: 'Clear filters', href: '/browse' }}
          />,
        ),
      );
      const p = await openAt(browser, width, markup, css());
      const m = await p.evaluate(() => {
        const doc = document.documentElement;
        const action = document.querySelector<HTMLElement>('.ad-state a')!.getBoundingClientRect();
        return { overflow: doc.scrollWidth - doc.clientWidth, h: action.height, actions: document.querySelectorAll('.ad-state a, .ad-state button').length };
      });
      await p.close();
      expect(m.overflow).toBeLessThanOrEqual(0);
      expect(m.h).toBeGreaterThanOrEqual(44);
      expect(m.actions).toBe(1);
    });

    it(`Show more failed state stays centred with one action at ${width}px`, async () => {
      const failed = renderToStaticMarkup(
        <div className="web-grid-more web-grid-more--failed">
          <p role="alert" className="web-grid-error">
            Could not load more videos. The ones above are still here.
          </p>
          <Button variant="secondary" size="lg">Try again</Button>
        </div>,
      );
      const p = await openAt(browser, width, page(failed), css());
      const m = await p.evaluate(() => {
        const doc = document.documentElement;
        const b = document.querySelector<HTMLElement>('.web-grid-more .ad-btn')!.getBoundingClientRect();
        return { overflow: doc.scrollWidth - doc.clientWidth, h: b.height, w: b.width, buttons: document.querySelectorAll('.web-grid-more button').length };
      });
      await p.close();
      expect(m.overflow).toBeLessThanOrEqual(0);
      expect(m.h).toBeGreaterThanOrEqual(44);
      expect(m.w).toBeGreaterThanOrEqual(176);
      expect(m.buttons).toBe(1);
    });
  }
});
