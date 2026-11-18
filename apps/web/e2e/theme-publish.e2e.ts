import { expect, test, type Page } from '@playwright/test';
import { ACCOUNTS } from './support/accounts';
import { startSmtpSink } from './support/smtp-sink';

/**
 * Theme engine proof on real services: an admin picks colours and a font in /admin/theme, publishes, and the
 * viewer Home and Watch pages, the web manifest theme_color and the next email all follow, with no deploy.
 *
 * Needs the stack from scripts/e2e-video-up.sh (its SMTP_URL points at port 1025) and
 * `E2E_THEME=1 E2E_SMTP_PORT=1025`. Run with E2E_CHROMIUM_PATH=/opt/google/chrome/chrome if no bundled browser.
 */
const smtpPort = Number(process.env.E2E_SMTP_PORT ?? 0);
test.skip(
  !process.env.E2E_THEME || !smtpPort,
  'set E2E_THEME=1 and E2E_SMTP_PORT with the e2e stack',
);
test.use({
  launchOptions: process.env.E2E_CHROMIUM_PATH
    ? { executablePath: process.env.E2E_CHROMIUM_PATH, args: ['--no-sandbox'] }
    : {},
});
test.describe.configure({ mode: 'serial', timeout: 120_000 });
// The admin editor is a desktop tool and the viewer checks read computed styles, so one project is enough.
test.skip(({ isMobile }) => isMobile, 'desktop only');

const PRESETS = {
  lavender: { primary: '#6D4FC2', bg: '#F5F2FB' },
  'sky blue': { primary: '#1A6FB8', bg: '#EFF6FC' },
};
const SITE_NAME = 'Sunrise Learning TV';

const readTheme = (page: Page) =>
  page.evaluate(() => {
    const css = getComputedStyle(document.documentElement);
    return {
      primary: css.getPropertyValue('--color-primary').trim().toUpperCase(),
      bg: css.getPropertyValue('--color-bg').trim().toUpperCase(),
      font: css.getPropertyValue('--font-sans').trim(),
      meta:
        document
          .querySelector('meta[name="theme-color"]')
          ?.getAttribute('content')
          ?.toUpperCase() ?? '',
    };
  });

let sink: Awaited<ReturnType<typeof startSmtpSink>>;
test.beforeAll(async () => {
  sink = await startSmtpSink(smtpPort);
});
test.afterAll(async () => {
  await sink?.close();
});

test('publishing in /admin/theme reaches the viewer, the manifest and emails without a deploy', async ({
  browser,
  baseURL,
}) => {
  const viewer = await browser.newPage();
  await viewer.goto('/');
  const before = await readTheme(viewer);
  const beforeManifest = await (await viewer.request.get('/manifest.webmanifest')).json();
  expect(beforeManifest.theme_color.toUpperCase()).toBe(before.primary);

  const admin = await browser.newPage();
  await admin.goto('/admin/login');
  await admin.getByLabel('Email').fill(ACCOUNTS.admin.email);
  await admin.getByLabel('Password').fill(ACCOUNTS.admin.password);
  await admin.getByRole('button', { name: 'Sign in' }).click();
  await expect(admin).toHaveURL(/\/admin(?!\/login)/, { timeout: 30_000 });

  await admin.goto('/admin/theme');
  // Re-runs on the same database start from the last published theme, so pick the one that is not current.
  const picked = (await admin.getByRole('radio', { name: /lavender/i }).isChecked())
    ? 'sky blue'
    : 'lavender';
  const LAVENDER = PRESETS[picked];
  await admin.getByRole('radio', { name: new RegExp(picked, 'i') }).check();
  const font = (await admin.getByRole('radio', { name: /nunito/i }).isChecked())
    ? 'DM Sans'
    : 'Nunito';
  await admin.getByRole('radio', { name: new RegExp(font, 'i') }).check();
  await admin.getByLabel('Platform name').fill(SITE_NAME);
  await admin.getByRole('button', { name: 'Publish theme' }).click();
  await admin.getByRole('dialog').getByRole('button', { name: 'Publish theme' }).click();
  await expect(admin.getByText(/Published version/)).toBeVisible({ timeout: 20_000 });

  // Home and Watch: the root layout carries the published colours and font on every page.
  for (const path of ['/', '/watch/not-a-real-video']) {
    await viewer.goto(path);
    const after = await readTheme(viewer);
    expect(after.primary, path).toBe(LAVENDER.primary);
    expect(after.bg, path).toBe(LAVENDER.bg);
    expect(after.font, path).toContain(font);
    expect(after.meta, path).toBe(LAVENDER.primary);
  }

  // PWA: the manifest follows the same published values.
  const manifest = await (await viewer.request.get('/manifest.webmanifest')).json();
  expect(manifest.theme_color.toUpperCase()).toBe(LAVENDER.primary);
  expect(manifest.name).toBe(SITE_NAME);

  // Email: the next message uses the new name and colours.
  await viewer.goto('/forgot-password');
  await viewer.getByLabel(/Email/).fill(ACCOUNTS.viewer.email);
  await viewer.getByRole('button', { name: 'Send link' }).click();
  await expect
    .poll(
      () => sink.mails.find((m) => m.to.toLowerCase().includes(ACCOUNTS.viewer.email))?.data ?? '',
      {
        timeout: 20_000,
      },
    )
    .not.toBe('');
  const mail = sink.mails.find((m) => m.to.toLowerCase().includes(ACCOUNTS.viewer.email))!;
  const decoded = mail.data.replace(/=\r?\n/g, '').replace(/=3D/g, '=');
  expect(decoded).toContain(SITE_NAME);
  expect(decoded.toUpperCase()).toContain(`BACKGROUND:${LAVENDER.primary}`);
  expect(decoded.toUpperCase()).toContain(`BACKGROUND:${LAVENDER.bg}`);
  expect(baseURL).toBeTruthy();
});
