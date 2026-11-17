import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

// docs/DESIGN-SYSTEM.md section 6: every tap target is at least 44 by 44 CSS px.
async function expectBig(page: Page, selector: string, label: string) {
  // A client side refresh can replace the document once, so measure with retries.
  await expect(async () => {
    const boxes = await page.locator(selector).evaluateAll((els) =>
      els
        .filter((el) => (el as HTMLElement).offsetParent !== null)
        .map((el) => {
          const r = el.getBoundingClientRect();
          return { text: (el.textContent ?? '').trim().slice(0, 30), w: r.width, h: r.height };
        }),
    );
    expect(boxes.length, `${label} found`).toBeGreaterThan(0);
    for (const box of boxes) {
      expect(box.w, `${label} "${box.text}" width`).toBeGreaterThanOrEqual(43.5);
      expect(box.h, `${label} "${box.text}" height`).toBeGreaterThanOrEqual(43.5);
    }
  }).toPass({ timeout: 10_000 });
}

test('footer links', async ({ page }) => {
  await page.goto('/browse');
  await expectBig(page, '.ad-footer__links a', 'footer link');
});

test('sign in inline links', async ({ page, context }) => {
  await context.clearCookies();
  await page.goto('/sign-in');
  await expectBig(page, '.web-form__alt a', 'alternate link');
});

test('sign up inline links', async ({ page, context }) => {
  await context.clearCookies();
  await page.goto('/sign-up');
  await expectBig(page, '.web-form__alt a, .web-form__fine a', 'sign up link');
});

test('legal contents links', async ({ page }) => {
  await page.goto('/privacy');
  await expectBig(page, '.web-legal__toc a', 'contents link');
});
