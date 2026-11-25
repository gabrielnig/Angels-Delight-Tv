import type { Episode } from '../episode';
import { slow } from '../helpers-c7';
import { clickByName, highlight } from '../helpers';

/** T06: I cannot sign in, or my codes do not work. Wrong password and wrong code messages, and what to do next. */
const episode: Episode = {
  id: 'T06',
  title: 'I cannot sign in or I lost my phone',
  role: 'none',
  screens: ['/admin/login', '/admin/login/2fa'],
  actions: ['admin.access'],
  dependsOn: ['apps/web/src/app/admin/login', 'apps/web/src/components/admin/AuthLayout.tsx'],
  viewports: ['desktop', 'mobile'],
  steps: [
    {
      caption: 'Go to the sign in page, "/admin/login".',
      run: async (s) => {
        await s.goto('/admin/login');
        await s.page.getByLabel('Email').waitFor();
      },
      shot: {
        name: 'signin',
        alt: 'The staff sign in page with the Email box marked 1',
        scheme: 'dark',
        marks: [{ target: (s) => s.page.getByLabel('Email'), label: 'Email' }],
      },
    },
    {
      caption: 'Type your email in the **Email** box.',
      run: async (s) => {
        await s.type(s.page.getByLabel('Email'), 'ngozi@example.test');
      },
    },
    {
      caption: 'Type "not-the-password" in the **Password** box.',
      note: 'The demo shows a made up password. Never share your real password with anyone.',
      run: async (s) => {
        await s.type(s.page.getByLabel('Password'), 'not-the-password');
      },
    },
    {
      caption: 'Click **Sign in**.',
      run: async (s) => {
        await clickByName(s, 'button', 'Sign in', { exact: true });
        await s.page.getByRole('alert').first().waitFor();
      },
    },
    {
      caption: 'Check the **Sign in** heading and the message above the boxes.',
      note: 'The message is the same for a wrong email and a wrong password. This protects every account.',
      run: async (s) => {
        await highlight(s, s.page.getByRole('alert').first());
      },
      shot: {
        name: 'wrong',
        alt: 'The sign in page with the wrong password message marked 1',
        scheme: 'dark',
        marks: [{ target: (s) => s.page.getByRole('alert').first(), label: 'The message' }],
      },
    },
    {
      caption: 'Type your password in the **Password** box.',
      run: async (s) => {
        await s.type(s.page.getByLabel('Password'), 'fixture-password');
      },
    },
    {
      caption: 'Click **Sign in** again.',
      run: async (s) => {
        await clickByName(s, 'button', 'Sign in', { exact: true });
        await s.page.getByLabel('Digit 1 of 6').waitFor();
      },
    },
    {
      caption: 'Check the **Enter your code** page.',
      note: 'The code is in your authenticator app and changes every 30 seconds. Check the clock on your phone is right.',
      run: async (s) => {
        await highlight(s, s.page.getByRole('heading', { name: 'Enter your code' }));
      },
      shot: {
        name: 'code',
        alt: 'The code page with the six digit boxes marked 1',
        scheme: 'dark',
        marks: [{ target: (s) => s.page.getByRole('group', { name: '6 digit code' }), label: 'Code' }],
      },
    },
  ],
};

export default slow(episode, 1500);
