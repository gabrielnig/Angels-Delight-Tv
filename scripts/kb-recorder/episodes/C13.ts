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
      caption: 'Click **Account menu for Demo Editor**.',
      note: 'The menu is the round badge with your name at the top right.',
      run: async (s) => { await s.click(s.page.getByText('Account menu for').first()); await s.page.getByRole('link', { name: 'My account' }).waitFor(); },
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
      caption: 'Check the **Two step sign in** card.',
      note: 'It shows whether two step sign in is on and how many recovery codes you have left. Make new ones before you run out.',
      run: async (s) => highlight(s, s.page.getByText('Two step sign in', { exact: true }).first(), 2400),
      shot: {
        name: 'two-step',
        alt: 'The Two step sign in card with the recovery codes button marked 1',
        marks: [{ target: (s) => s.page.getByRole('button', { name: 'Make new recovery codes' }), label: 'Recovery codes' }],
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
