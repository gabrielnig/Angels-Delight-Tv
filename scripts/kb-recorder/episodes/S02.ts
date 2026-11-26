import { DEMO_ACCOUNTS, FIXTURE_CODE } from '../accounts';
import type { Episode } from '../episode';
import { highlight } from '../helpers';

/** S02 Sign in with an emailed code (D-397). Signed out at the start. The demo stack accepts the fixed code 123456. */
const account = DEMO_ACCOUNTS.editor;

const episode: Episode = {
  id: 'S02',
  title: 'Sign in and set up two step sign in',
  role: 'none',
  screens: ['/admin/login', '/admin/login/2fa'],
  dependsOn: ['apps/web/src/app/admin/login', 'apps/web/src/components/admin/AuthLayout.tsx'],
  viewports: ['desktop', 'mobile'],
  next: 'S03 Accept your invite and set your password',
  steps: [
    {
      caption: 'Go to the sign in page, "/admin/login".',
      note: 'Your developer gives you the full address of your site. Add this ending to it.',
      holdMs: 3500,
      run: async (s) => {
        await s.goto('/admin/login');
      },
      shot: {
        name: 'sign-in',
        alt: 'The admin sign in page with the Email box marked 1',
        scheme: 'dark',
        marks: [{ target: (s) => s.page.getByLabel('Email'), label: 'Email' }],
      },
    },
    {
      caption: 'Type your email in the **Email** box.',
      holdMs: 2800,
      run: async (s) => {
        await s.type(s.page.getByLabel('Email'), account.email);
      },
    },
    {
      caption: 'Type your password in the **Password** box.',
      note: 'The dots hide your password. Nobody can read it over your shoulder.',
      holdMs: 2800,
      run: async (s) => {
        await s.type(s.page.getByLabel('Password', { exact: true }), account.password);
      },
    },
    {
      caption: 'Click **Sign in**.',
      holdMs: 2800,
      run: async (s) => {
        await s.click(s.page.getByRole('button', { name: 'Sign in', exact: true }));
        await s.page.getByRole('heading', { name: 'Check your email' }).waitFor();
      },
    },
    {
      caption: 'Wait until you see **Check your email**.',
      note: 'We email a 6 digit code to your address. It works once and lasts 10 minutes.',
      holdMs: 3500,
      run: async (s) => {
        await s.page.getByRole('heading', { name: 'Check your email' }).waitFor();
        await s.pause(500);
      },
      shot: {
        name: 'code',
        alt: 'The Check your email page with the code box marked 1',
        scheme: 'dark',
        marks: [{ target: (s) => s.page.getByLabel('6 digit code', { exact: true }), label: 'Code box' }],
      },
    },
    {
      caption: 'Check that **Remember this device for 30 days** is ticked.',
      note: 'It is on by default. Untick it on a shared computer. If you use an authenticator app, the page asks for the app code instead.',
      holdMs: 3500,
      run: async (s) => {
        await highlight(s, s.page.getByLabel('Remember this device for 30 days'), 1800);
      },
      shot: {
        name: 'remember',
        alt: 'The Remember this device box marked 1',
        scheme: 'dark',
        marks: [{ target: (s) => s.page.getByLabel('Remember this device for 30 days'), label: 'Remember this device' }],
      },
    },
    {
      caption: 'Type the 6 digit code from the email in the **6 digit code** box.',
      note: 'If it has not come, wait a minute and click **Send a new code**. Only the newest code works.',
      holdMs: 2800,
      run: async (s) => {
        await s.click(s.page.getByLabel('6 digit code', { exact: true }));
        await s.page.keyboard.type(process.env.KB_2FA_CODE ?? FIXTURE_CODE, { delay: 140 * s.paceFactor });
        await s.pause(300);
      },
    },
    {
      caption: 'Click **Sign in**.',
      holdMs: 2800,
      run: async (s) => {
        await s.click(s.page.getByRole('button', { name: 'Sign in', exact: true }));
        await s.page.getByRole('heading', { name: 'Dashboard' }).waitFor();
      },
    },
    {
      caption: 'Wait until you see **Dashboard**. You are signed in.',
      holdMs: 7000,
      run: async (s) => {
        await s.pause(400);
      },
      shot: {
        name: 'dashboard',
        alt: 'The Dashboard with its heading marked 1',
        marks: [{ target: (s) => s.page.getByRole('heading', { name: 'Dashboard' }), label: 'Dashboard' }],
      },
    },
  ],
};

export default episode;
