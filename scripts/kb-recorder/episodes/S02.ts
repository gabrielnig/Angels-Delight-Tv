import { DEMO_ACCOUNTS, FIXTURE_CODE } from '../accounts';
import type { Episode } from '../episode';

/** S02 Sign in and set up two step sign in. Signed out at the start. Enrolment needs real sign in, so it is not shown. */
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
        await s.click(s.page.getByRole('button', { name: 'Sign in' }));
        await s.page.getByLabel('Digit 1 of 6').waitFor();
      },
    },
    {
      caption: 'Wait until you see **Enter your code**.',
      note: 'The first time, this page shows a square code to scan with an authenticator app. Scan it, then enter the code the app shows.',
      holdMs: 3500,
      run: async (s) => {
        await s.page.getByRole('heading', { name: 'Enter your code' }).waitFor();
        await s.pause(500);
      },
      shot: {
        name: 'code',
        alt: 'The Enter your code page with the six digit boxes marked 1',
        scheme: 'dark',
        marks: [{ target: (s) => s.page.getByLabel('Digit 1 of 6'), label: 'Code boxes' }],
      },
    },
    {
      caption: 'Type the 6 digit code from your app in the **Digit 1 of 6** box.',
      note: 'The code changes every 30 seconds. Type the one you see now.',
      holdMs: 2800,
      run: async (s) => {
        await s.click(s.page.getByLabel('Digit 1 of 6'));
        await s.page.keyboard.type(process.env.KB_2FA_CODE ?? FIXTURE_CODE, { delay: 140 * s.paceFactor });
        await s.pause(300);
      },
    },
    {
      caption: 'Click **Verify**.',
      holdMs: 2800,
      run: async (s) => {
        await s.click(s.page.getByRole('button', { name: 'Verify' }));
        await s.page.getByRole('heading', { name: 'Dashboard' }).waitFor();
      },
    },
    {
      caption: 'Wait until you see **Dashboard**. You are signed in.',
      holdMs: 3000,
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
