import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

// Fixture build: the sign in accepts the fixture password and code (see lib/data/admin/session.ts).
async function signIn(page: Page, email = 'chiamaka@example.test') {
  await page.goto('/admin/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill('fixture-password');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('heading', { name: 'Enter your code' })).toBeVisible();
  await page.getByLabel('Digit 1 of 6').click();
  await page.keyboard.type('123456');
  await page.getByRole('button', { name: 'Verify' }).click();
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
}

const MB = 1024 * 1024;
const file = (name: string, size: number) => ({ name, mimeType: 'video/mp4', buffer: Buffer.alloc(size, 1) });

test('wrong password gives one generic message', async ({ page }) => {
  await page.goto('/admin/login');
  await page.getByLabel('Email').fill('chiamaka@example.test');
  await page.getByLabel('Password').fill('nope');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByText('Email or password is not right. Check both and try again.')).toBeVisible();
});

test('anonymous visitors are sent to admin sign in', async ({ page }) => {
  await page.goto('/admin/videos');
  await expect(page).toHaveURL(/\/admin\/login\?next=%2Fadmin%2Fvideos/);
});

test('admin signs in, uploads two files, one fails and resumes with Retry', async ({ page }) => {
  await signIn(page);
  const menu = page.getByRole('button', { name: 'Open menu' });
  if (await menu.isVisible()) await menu.click();
  await page.getByRole('navigation', { name: 'Admin' }).getByRole('link', { name: 'Upload', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Upload videos' })).toBeVisible();
  await expect(page.getByText('Nothing uploading.')).toBeVisible();

  await page.getByTestId('file-input').setInputFiles([file('lesson one.mp4', 10 * MB), file('flaky lesson.mp4', 20 * MB), { name: 'movie.avi', mimeType: 'video/x-msvideo', buffer: Buffer.alloc(MB) }]);

  await expect(page.getByRole('alert').filter({ hasText: 'movie.avi is not supported. Use MP4, MOV or MKV.' })).toBeVisible();
  await expect(page.getByText('Uploaded just now')).toBeVisible({ timeout: 20_000 });
  await expect(page.locator('.adm-lane__text').filter({ hasText: /Upload failed\. \d+ percent was saved\./ })).toBeVisible({ timeout: 20_000 });

  await page.getByRole('button', { name: 'Retry flaky lesson.mp4' }).click();
  await expect(page.getByText('Uploaded just now')).toHaveCount(2, { timeout: 20_000 });
  await expect(page.getByRole('link', { name: 'Edit details for lesson one.mp4' })).toBeVisible();
});

test('an editor does not see admin only pages', async ({ page }) => {
  await signIn(page, 'ngozi@example.test');
  await expect(page.getByRole('navigation', { name: 'Admin' })).not.toContainText('Audit log');
  await page.goto('/admin/audit-log');
  await expect(page.getByText('You do not have access to this page')).toBeVisible();
});
