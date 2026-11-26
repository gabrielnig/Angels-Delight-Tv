import type { Episode } from '../episode';
import { slow } from '../helpers-c7';
import { pointAt, settle } from '../safety-helpers';

/** K07: the safe habits that live on My account: password rules, the Security card, remembered devices, devices. */
const episode: Episode = {
  id: 'K07',
  title: 'Keep the admin safe',
  role: 'editor',
  screens: ['/admin/account'],
  actions: ['account.own'],
  dependsOn: [
    'apps/web/src/components/admin/MyAccountView.tsx',
    'packages/auth/src/policy.ts',
    'apps/web/src/components/admin/AdminShell.tsx',
  ],
  next: 'K08 What data we keep and for how long',
  steps: [
    {
      caption: 'Click **Account menu**.',
      run: async (s) => {
        await s.click(s.page.getByText('Account menu for').locator('..'));
        await s.page.getByRole('link', { name: 'My account' }).waitFor();
      },
    },
    {
      caption: 'Click **My account**.',
      run: async (s) => {
        await s.click(s.page.getByRole('link', { name: 'My account' }));
        await s.page.getByRole('heading', { name: 'My account' }).first().waitFor();
        await settle(s, 600);
      },
    },
    {
      caption: 'Scroll to **Password**.',
      note: 'Use a long password that you use nowhere else. Three unrelated words and a number work well.',
      run: async (s) => {
        const h = s.page.getByRole('heading', { name: 'Password', exact: true });
        await s.reveal(h, 0.2);
        await pointAt(s, h);
      },
    },
    {
      caption: 'Type "river" in the **New password** box.',
      note: 'This is only to show the rules. Nothing is saved until you press Change password.',
      run: async (s) => {
        await s.type(s.page.getByLabel('New password', { exact: true }), 'river');
      },
      shot: {
        name: 'password-rules',
        alt: 'The password rules list under the New password box, marked 1',
        marks: [{ target: (s) => s.page.getByRole('list', { name: 'Password rules' }), label: 'Password rules' }],
      },
    },
    {
      caption: 'Scroll to **Security**.',
      note: 'Every staff account has a second step. It asks for a code we email you, or one from your authenticator app.',
      run: async (s) => {
        const h = s.page.getByRole('heading', { name: 'Security', exact: true });
        await s.reveal(h, 0.2);
        await pointAt(s, h);
      },
      shot: {
        name: 'security',
        alt: 'The Security card showing the second step in use, marked 1',
        marks: [{ target: (s) => s.page.getByRole('heading', { name: 'Security', exact: true }), label: 'Security' }],
      },
    },
    {
      caption: 'Scroll to **Remembered devices**.',
      note: 'These browsers skip the emailed code. Click **Forget** beside any you do not use. Authenticator app users see **Make new recovery codes** on the Security card instead. Each recovery code works once, so keep them private.',
      run: async (s) => {
        const h = s.page.getByRole('heading', { name: 'Remembered devices', exact: true });
        await s.reveal(h, 0.2);
        await pointAt(s, h);
      },
      shot: {
        name: 'remembered',
        alt: 'The Remembered devices card with its Forget button marked 1',
        marks: [{ target: (s) => s.page.getByRole('button', { name: /^Forget / }).first(), label: 'Forget' }],
      },
    },
    {
      caption: 'Scroll to **Where you are signed in**.',
      note: 'Sign out any device you do not know or no longer use. Staff sessions end after 60 minutes of no use.',
      run: async (s) => {
        const h = s.page.getByRole('heading', { name: 'Where you are signed in' });
        await s.reveal(h, 0.2);
        await pointAt(s, h);
      },
      shot: {
        name: 'devices',
        alt: 'The list of devices where you are signed in, marked 1',
        marks: [{ target: (s) => s.page.getByRole('heading', { name: 'Where you are signed in' }), label: 'Your devices' }],
      },
    },
  ],
};

export default slow(episode, 3800);
