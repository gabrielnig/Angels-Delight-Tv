import type { Episode } from '../episode';
import { pointAt, settle } from '../safety-helpers';

/** K07: the safe habits that live on My account: password rules, two step sign in, recovery codes, devices. */
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
      caption: 'Scroll to **Two step sign in**.',
      note: 'Two step sign in is on for every staff account. It asks for a code from your phone.',
      run: async (s) => {
        const h = s.page.getByRole('heading', { name: 'Two step sign in' });
        await s.reveal(h, 0.2);
        await pointAt(s, h);
      },
    },
    {
      caption: 'Click **Make new recovery codes**.',
      note: 'Recovery codes let you in if you lose your phone. Each code works once. Keep them somewhere safe and private.',
      run: async (s) => {
        const b = s.page.getByRole('button', { name: 'Make new recovery codes' });
        await s.click(b);
        await s.page.getByRole('dialog').waitFor();
        await settle(s, 600);
      },
      shot: {
        name: 'recovery-box',
        alt: 'The Make new recovery codes box asking for the authenticator code, marked 1',
        marks: [{ target: (s) => s.page.getByRole('dialog').getByLabel('Authenticator code'), label: 'Authenticator code' }],
      },
    },
    {
      caption: 'Check that **Your old codes stop working.** is in the box.',
      run: async (s) => {
        await pointAt(s, s.page.getByRole('dialog').getByText('Your old codes stop working.'));
      },
    },
    {
      caption: 'Click **Cancel**.',
      note: 'Do not paste recovery codes into chats or emails, and do not take pictures of them.',
      run: async (s) => {
        await s.click(s.page.getByRole('dialog').getByRole('button', { name: 'Cancel' }));
        await settle(s, 500);
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

export default episode;
