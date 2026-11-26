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
      caption: 'Type "wrongpassword" in the **Password** box.',
      note: 'The demo shows a made up password. Never share your real password with anyone.',
      run: async (s) => {
        await s.type(s.page.getByLabel('Password', { exact: true }), 'wrongpassword');
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
        await s.type(s.page.getByLabel('Password', { exact: true }), 'fixture-password');
      },
    },
    {
      caption: 'Click **Sign in** again.',
      run: async (s) => {
        await clickByName(s, 'button', 'Sign in', { exact: true });
        await s.page.getByRole('heading', { name: 'Check your email' }).waitFor();
      },
    },
    {
      caption: 'Check the **Check your email** page.',
      note: 'The code is in the email we sent and lasts 10 minutes. If it has not come, wait a minute and click Send a new code. App users type the app code instead.',
      run: async (s) => {
        await highlight(s, s.page.getByRole('heading', { name: 'Check your email' }));
      },
      shot: {
        name: 'code',
        alt: 'The Check your email page with the code box marked 1',
        scheme: 'dark',
        marks: [{ target: (s) => s.page.getByLabel('6 digit code', { exact: true }), label: 'Code' }],
      },
    },
  ],
};

export default slow(episode, 3000);
