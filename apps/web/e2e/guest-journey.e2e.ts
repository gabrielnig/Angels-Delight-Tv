import { expect, test } from '@playwright/test';
import { latestCode, startSmtpSink } from './support/smtp-sink';

/**
 * A visitor without an account (M40): Home, a title, Play, the My List dialog, then sign up, the save finishes and
 * the device history is offered. Needs a server on real data with the demo catalogue and an SMTP sink on
 * E2E_SMTP_PORT, as in viewer-real.e2e.ts. Skipped otherwise.
 */
const smtpPort = Number(process.env.E2E_SMTP_PORT ?? 0);
test.skip(
  !process.env.E2E_REAL || !smtpPort,
  'set E2E_REAL=1 and E2E_SMTP_PORT for the guest journey on real services',
);

const stamp = Date.now();
const email = `guest${stamp}@example.com`;
const password = `Quiet-river-${stamp}-lamp`;

test('a visitor browses, plays, is asked to sign in only to save, and keeps their place', async ({
  browser,
}) => {
  const sink = await startSmtpSink(smtpPort);
  const context = await browser.newContext();
  const page = await context.newPage();
  try {
    await page.goto('/');
    await expect(page.getByRole('region', { name: 'Featured' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Sign in' })).toBeVisible();

    await page.locator('a[href^="/title/"]').first().click();
    await expect(page).toHaveURL(/\/title\//);
    const titleUrl = page.url();
    const play = page.getByRole('link', { name: /^(Play|Resume)/ }).first();
    await play.click();
    await expect(page).toHaveURL(/\/watch\//);
    await expect(page.locator('video')).toBeVisible();
    // Progress is written to this device, never to /api/progress.
    const progressCalls: string[] = [];
    page.on('request', (request) => {
      if (request.url().includes('/api/progress')) progressCalls.push(request.url());
    });
    await page.waitForTimeout(7000);
    await page.goto(titleUrl);
    await expect(page.getByRole('link', { name: /^Resume/ }).first()).toBeVisible();
    expect(progressCalls).toEqual([]);

    // A save needs an account, so the dialog opens and nothing is stored.
    await page.getByRole('button', { name: 'My List', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Save this to My List' });
    await expect(dialog).toBeVisible();
    await dialog.getByRole('link', { name: 'Create account' }).click();
    await expect(page).toHaveURL(/\/sign-up\?next=/);

    await page.getByLabel('Email').fill(email);
    await page.locator('input[name="password"]').fill(password);
    await page.getByRole('button', { name: 'Create account' }).click();
    await expect(page).toHaveURL(/\/verify-email/, { timeout: 20_000 });
    await expect.poll(() => latestCode(sink.mails, email), { timeout: 20_000 }).not.toBeNull();
    await page.keyboard.type(latestCode(sink.mails, email)!);
    await expect(page).toHaveURL(/\/profiles/, { timeout: 20_000 });
    await page.goto('/profiles/new');
    await page.getByLabel('Name').fill('Ada');
    await page.getByRole('button', { name: 'Create profile' }).click();
    await page.goto('/profiles?switch=1');
    await page.getByRole('button', { name: /Ada/ }).first().click();

    // The save the visitor asked for is done, and the device history is offered.
    await expect(page.getByText('Added to My List', { exact: true })).toBeVisible({
      timeout: 20_000,
    });
    const offer = page.getByRole('dialog', { name: 'Add what you watched here?' });
    await expect(offer).toBeVisible();
    await offer.getByRole('button', { name: 'Add to my history' }).click();
    await expect(page.getByText(/Added \d+ videos? to your history/)).toBeVisible();
  } finally {
    await context.close();
    await sink.close();
  }
});

test('personal pages still send a visitor to sign in', async ({ browser }) => {
  const page = await (await browser.newContext()).newPage();
  await page.goto('/account');
  await expect(page).toHaveURL(/\/sign-in/);
  const response = await page.request.get(
    '/api/my-list?profileId=00000000-0000-4000-8000-000000000000',
  );
  expect(response.status()).toBe(401);
  await page.close();
});
