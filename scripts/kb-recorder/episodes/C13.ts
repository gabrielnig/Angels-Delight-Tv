import type { Episode } from '../episode';
import { clickByName, highlight, padSteps, typeInto } from '../c3-helpers';

const episode: Episode = {
  id: 'C13',
  title: 'Your own account',
  role: 'editor',
  screens: ['/admin/account'],
  actions: ['account.own'],
  dependsOn: ['apps/web/src/components/admin/MyAccountView.tsx', 'apps/web/src/components/admin/NotificationPrefsCard.tsx', 'apps/web/src/components/admin/AdminShell.tsx'],
  next: 'C14 System: jobs, storage and player quality',
  steps: padSteps([
    {
      caption: 'Click **Demo Editor** in the top bar.',
      note: 'The menu is the round badge with your name at the top right.',
      run: async (s) => { await s.click(s.page.locator('summary').filter({ hasText: 'Demo Editor' })); await s.page.getByRole('link', { name: 'My account' }).waitFor(); },
    },
    {
      caption: 'Click **My account**.',
      run: async (s) => { await clickByName(s, 'link', 'My account'); await s.page.getByRole('heading', { name: 'My account' }).first().waitFor(); },
      shot: {
        name: 'account',
        alt: 'The My account screen with the Profile card marked 1',
        marks: [{ target: (s) => s.page.getByLabel('Display name', { exact: true }), label: 'Display name' }],
      },
    },
    {
      caption: 'Type "Demo Editor One" in the **Display name** box.',
      run: async (s) => typeInto(s, 'Display name', 'Demo Editor One'),
    },
    {
      caption: 'Click **Save name**.',
      run: async (s) => { await clickByName(s, 'button', 'Save name'); await s.pause(1200); },
    },
    {
      caption: 'Check the **Security** card.',
      note: 'It shows whether you get a code by email or from an authenticator app. Use **Switch to an authenticator app** or **Switch to emailed codes** to change it.',
      run: async (s) => highlight(s, s.page.getByRole('heading', { name: 'Security', exact: true }).first(), 2400),
      shot: {
        name: 'security',
        alt: 'The Security card with the Switch to an authenticator app button marked 1',
        marks: [{ target: (s) => s.page.getByRole('button', { name: 'Switch to an authenticator app' }), label: 'Switch method' }],
      },
    },
    {
      caption: 'Check the **Remembered devices** card.',
      note: 'These browsers skip the emailed code until they expire. Click **Forget** beside one you no longer trust.',
      run: async (s) => highlight(s, s.page.getByRole('heading', { name: 'Remembered devices', exact: true }), 2400),
      shot: {
        name: 'remembered',
        alt: 'The Remembered devices card with its Forget button marked 1',
        marks: [{ target: (s) => s.page.getByRole('button', { name: /^Forget / }).first(), label: 'Forget' }],
      },
    },
    {
      caption: 'Click **Sign out Laptop, Firefox**.',
      note: 'Use this when you left yourself signed in on a shared computer. Sign out only the other devices, not this browser.',
      run: async (s) => { await clickByName(s, 'button', 'Sign out Laptop, Firefox'); await s.pause(1500); },
      shot: {
        name: 'devices',
        alt: 'The list of places you are signed in, marked 1',
        marks: [{ target: (s) => s.page.getByText('Where you are signed in').first(), label: 'Your devices' }],
      },
    },
    {
      caption: 'Check the **Email notifications** card.',
      note: 'Choose which emails you get: failures, captions ready to review and a daily summary. Security emails like password resets are always sent.',
      run: async (s) => highlight(s, s.page.getByText('Email notifications', { exact: true }).first(), 2600),
    },
  ]),
};
export default episode;
