import { expect, test, type Page } from '@playwright/test';
import { latestCode, startSmtpSink } from './support/smtp-sink';

/**
 * End to end on real services (lanes B and C): sign up, verify by email, create a profile, Home, My List, resume.
 * Needs a server on real data and an SMTP sink on E2E_SMTP_PORT (the same port as SMTP_URL), see
 * docs/lanes/K1-viewer-integration.md. Skipped otherwise, so the fixture suite is not affected.
 */
const smtpPort = Number(process.env.E2E_SMTP_PORT ?? 0);
test.skip(
  !process.env.E2E_REAL || !smtpPort,
  'set E2E_REAL=1 and E2E_SMTP_PORT for the real services smoke',
);
test.describe.configure({ mode: 'serial' });

const stamp = Date.now();
const email = `viewer${stamp}@example.com`;
const password = `Quiet-river-${stamp}-lamp`;

let sink: Awaited<ReturnType<typeof startSmtpSink>>;
let page: Page;

test.beforeAll(async ({ browser }) => {
  sink = await startSmtpSink(smtpPort);
  page = await browser.newPage();
});
test.afterAll(async () => {
  await page?.close();
  await sink?.close();
});

test('sign up, verify the email code and create a profile', async () => {
  await page.goto('/sign-up');
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
  await expect(page).toHaveURL(/\/profiles\/manage/);
  await expect(page.getByText('Ada').first()).toBeVisible();
});

test('the profile picker selects the profile and Home shows real titles', async () => {
  await page.goto('/profiles?switch=1');
  await page.getByRole('button', { name: /Ada/ }).first().click();
  await expect(page).toHaveURL(/\/$/);
  // Demo catalogue from `pnpm db:seed:demo`: a hero and at least one curated row.
  await expect(page.getByRole('region', { name: 'Featured' })).toBeVisible();
  await expect(page.getByRole('heading', { level: 2, name: 'Start here' })).toBeVisible();
  await expect(page.locator('a[href^="/series/"], a[href^="/title/"]').first()).toBeVisible();
});

test('My List saves a title and shows it', async () => {
  await page.goto('/browse');
  await page.locator('a[href^="/title/"]').first().click();
  await expect(page).toHaveURL(/\/title\//);
  const title = await page.getByRole('heading', { level: 1 }).innerText();
  await page.getByRole('button', { name: 'My List', exact: true }).click();
  // The label changes to In My List when the title is saved.
  await expect(page.getByRole('button', { name: 'In My List', pressed: true })).toBeVisible();
  // The button flips at once and the save follows. Leave the page only after the confirmation toast.
  await expect(page.getByText('Added to My List', { exact: true })).toBeVisible();

  await page.goto('/my-list');
  await expect(page.getByText(title).first()).toBeVisible();
  await expect(page.getByText('1 saved')).toBeVisible();
  await page.reload();
  await expect(page.getByText(title).first()).toBeVisible();
});

test('progress saved through the API shows as Continue Watching and resumes', async () => {
  const profiles = await (await page.request.get('/api/profiles')).json();
  const profileId = profiles.profiles[0].id as string;
  // Other specs may have published short clips into the same catalogue. Resume needs a title longer than 2 minutes.
  await page.goto('/browse');
  const hrefs = await page
    .locator('a[href^="/title/"]')
    .evaluateAll((els) =>
      els.map((el) => (el as HTMLAnchorElement).getAttribute('href') as string),
    );
  let slug = '';
  let videoId = '';
  for (const href of hrefs) {
    const candidate = href.split('/title/')[1]!.split('?')[0]!;
    const found = await (
      await page.request.get(`/api/titles/${candidate}?profileId=${profileId}&kind=video`)
    ).json();
    if ((found.card?.durationMs ?? 0) >= 120_000) {
      slug = candidate;
      videoId = found.card.id as string;
      break;
    }
  }
  expect(slug, 'a title of at least 2 minutes in the catalogue').not.toBe('');
  await page.goto(`/title/${slug}`);
  await expect(page).toHaveURL(/\/title\/(.+)$/);
  const title = await page.getByRole('heading', { level: 1 }).innerText();
  const origin = new URL(page.url()).origin;
  const saved = await page.request.post('/api/progress', {
    headers: { origin },
    data: { profileId, videoId, positionMs: 61_000, seek: true },
  });
  expect(saved.status()).toBe(200);

  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: 'Continue watching', exact: false }).first(),
  ).toBeVisible();
  await page.reload();
  await page.goto(`/title/${slug}`);
  await expect(page.getByRole('link', { name: /^Resume/ }).first()).toBeVisible();
  // The S18 phone layout has no Start over link, only the Resume button.
  if (test.info().project.name === 'desktop') {
    await expect(page.getByRole('link', { name: 'Start over' })).toHaveAttribute('href', /\?t=0$/);
  }

  await page
    .getByRole('link', { name: /^Resume/ })
    .first()
    .click();
  await expect(page).toHaveURL(new RegExp(`/watch/${videoId}`));
  await expect(page.getByText(title).first()).toBeVisible();
});

test('a signed out visitor sees the public preview and is sent to sign in for the player', async ({
  browser,
}) => {
  const anon = await browser.newPage();
  await anon.goto('/browse');
  await expect(anon).toHaveURL(/\/sign-in/);
  await anon.close();
});

test('another account cannot read this profile through the API', async ({ browser }) => {
  const profiles = await (await page.request.get('/api/profiles')).json();
  const profileId = profiles.profiles[0].id as string;
  const stranger = await browser.newPage();
  // Personal routes stay 401 without a session. Home is a public GET for guests since M40, and a guest never
  // receives the profile's own progress or list, whatever profileId the request names.
  const personal = await stranger.request.get(`/api/progress?profileId=${profileId}`);
  expect(personal.status()).toBe(401);
  const home = await stranger.request.get(`/api/home?profileId=${profileId}`);
  expect(home.status()).toBe(200);
  expect(JSON.stringify(await home.json())).not.toContain('"inMyList":true');
  await stranger.close();
});
