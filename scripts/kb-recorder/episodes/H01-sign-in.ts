import { DEMO_ACCOUNTS, FIXTURE_CODE } from '../accounts';
import type { Episode } from '../episode';

/** Harness proof episode: the admin sign in, start to finish, signed out at the start. */
const account = DEMO_ACCOUNTS.editor;

const episode: Episode = {
  id: 'H01-sign-in',
  title: 'Sign in to the admin',
  role: 'none',
  screens: ['/admin/login', '/admin/login/2fa'],
  dependsOn: ['apps/web/src/app/admin/login', 'apps/web/src/components/admin/auth'],
  steps: [
    {
      caption: 'Open the admin sign in page.',
      run: async (s) => {
        await s.goto('/admin/login');
      },
      shot: {
        name: 'sign-in-page',
        alt: 'The admin sign in page with the Email box marked 1',
        scheme: 'dark',
        marks: [{ target: (s) => s.page.getByLabel('Email'), label: 'Email' }],
      },
    },
    {
      caption: 'Type your email.',
      run: async (s) => {
        await s.type(s.page.getByLabel('Email'), account.email);
      },
    },
    {
      caption: 'Type your password.',
      run: async (s) => {
        await s.type(s.page.getByLabel('Password'), account.password);
      },
    },
    {
      caption: 'Choose Sign in.',
      run: async (s) => {
        await s.click(s.page.getByRole('button', { name: 'Sign in' }));
        await s.page.getByLabel('Digit 1 of 6').waitFor();
      },
    },
    {
      caption: 'Type the 6 digit code from your authenticator app.',
      note: 'The code changes every 30 seconds.',
      run: async (s) => {
        await s.click(s.page.getByLabel('Digit 1 of 6'));
        await s.page.keyboard.type(process.env.KB_2FA_CODE ?? FIXTURE_CODE, { delay: 120 });
      },
    },
    {
      caption: 'Choose Verify.',
      run: async (s) => {
        await s.click(s.page.getByRole('button', { name: 'Verify' }));
        await s.page.getByRole('heading', { name: 'Dashboard' }).waitFor();
      },
      shot: {
        name: 'dashboard',
        alt: 'The Dashboard with its heading marked 1',
        marks: [
          { target: (s) => s.page.getByRole('heading', { name: 'Dashboard' }), label: 'Dashboard' },
        ],
      },
    },
  ],
};

export default episode;
