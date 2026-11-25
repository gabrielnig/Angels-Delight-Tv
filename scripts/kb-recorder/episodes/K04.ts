import type { Episode } from '../episode';
import { goToScreen } from '../helpers';
import { clickAndLoad, pointAt, settle } from '../safety-helpers';

/** K04: find a viewer account, sign them out everywhere, suspend and reinstate. Admin. Phone recording too. */
const episode: Episode = {
  id: 'K04',
  title: 'Suspend an account and sign someone out everywhere',
  role: 'admin',
  screens: ['/admin/users', '/admin/users/[id]'],
  actions: ['users.view', 'users.suspend'],
  covers: { nav: ['Users'] },
  viewports: ['desktop', 'mobile'],
  dependsOn: [
    'apps/web/src/components/admin/UserDetail.tsx',
    'apps/web/src/components/admin/UsersTable.tsx',
    'apps/web/src/components/admin/UsersTableClient.tsx',
  ],
  next: 'K05 Reset a viewer\'s two step sign in and delete an account on request',
  steps: [
    {
      caption: 'Choose **Users** in the side menu.',
      note: 'Users lists viewer accounts. Staff are managed under Roles and invites.',
      run: async (s) => {
        await goToScreen(s, 'Users');
        await s.page.getByRole('heading', { name: 'Users' }).first().waitFor();
      },
    },
    {
      caption: 'Type "adaeze" in the **Search by email or profile name** box.',
      run: async (s) => {
        await s.type(s.page.getByLabel('Search by email or profile name'), 'adaeze');
      },
    },
    {
      caption: 'Click **Search**.',
      run: async (s) => {
        await clickAndLoad(s, s.page.getByRole('button', { name: 'Search', exact: true }));
        await s.page.getByRole('link', { name: 'adaeze@example.test' }).first().waitFor();
        await settle(s, 600);
      },
      shot: {
        name: 'search',
        alt: 'The Users list showing one result, marked 1',
        marks: [{ target: (s) => s.page.getByRole('link', { name: 'adaeze@example.test' }).first(), label: 'The account' }],
      },
    },
    {
      caption: 'Click **adaeze@example.test** to open the account.',
      run: async (s) => {
        await s.click(s.page.getByRole('link', { name: 'adaeze@example.test' }).first());
        await s.page.getByRole('heading', { name: 'Support actions' }).waitFor();
        await settle(s, 600);
      },
    },
    {
      caption: 'Scroll to **Signed in on**.',
      note: 'This shows how many devices are signed in to the account right now.',
      run: async (s) => {
        const t = s.page.getByText('Signed in on').first();
        await s.reveal(t, 0.3);
        await pointAt(s, t);
      },
    },
    {
      caption: 'Click **Sign out everywhere**.',
      note: 'The person can sign in again with their password.',
      run: async (s) => {
        await s.click(s.page.getByRole('button', { name: 'Sign out everywhere', exact: true }).first());
        await s.page.getByRole('dialog').waitFor();
        await settle(s, 500);
      },
      shot: {
        name: 'sign-out-box',
        alt: 'The Sign out of every device box with the Reason box marked 1',
        marks: [{ target: (s) => s.page.getByRole('dialog').getByLabel('Reason'), label: 'Reason' }],
      },
    },
    {
      caption: 'Type "Phone was lost" in the **Reason** box.',
      note: 'The reason is kept in the audit log. Write it so a colleague understands.',
      run: async (s) => {
        await s.type(s.page.getByRole('dialog').getByLabel('Reason'), 'Phone was lost');
      },
    },
    {
      caption: 'Click **Sign out everywhere** to confirm.',
      run: async (s) => {
        await s.click(s.page.getByRole('dialog').getByRole('button', { name: 'Sign out everywhere' }));
        await s.page.getByText('Signed out everywhere.').first().waitFor();
        await settle(s, 1200);
      },
    },
    {
      caption: 'Click **Suspend account**.',
      note: 'Suspending signs the person out and stops them signing in. Their profiles and lists are kept.',
      run: async (s) => {
        const b = s.page.getByRole('button', { name: 'Suspend account', exact: true }).first();
        await s.reveal(b, 0.4);
        await s.click(b);
        await s.page.getByRole('dialog').waitFor();
        await settle(s, 500);
      },
    },
    {
      caption: 'Type "Shared the account" in the **Reason** box.',
      run: async (s) => {
        await s.type(s.page.getByRole('dialog').getByLabel('Reason'), 'Shared the account');
      },
    },
    {
      caption: 'Click **Suspend account** to confirm.',
      run: async (s) => {
        await s.click(s.page.getByRole('dialog').getByRole('button', { name: 'Suspend account' }));
        await s.page.getByText('Account suspended.').first().waitFor();
        await settle(s, 1200);
      },
      shot: {
        name: 'suspended',
        alt: 'The account page with the red banner This account is suspended, marked 1',
        marks: [{ target: (s) => s.page.getByText('This account is suspended.'), label: 'Suspended' }],
      },
    },
    {
      caption: 'Click **Reinstate account**.',
      note: 'This is how you undo a suspension. The person can sign in again straight away.',
      run: async (s) => {
        const b = s.page.getByRole('button', { name: 'Reinstate account', exact: true }).first();
        await s.page.getByText('This account is suspended.').first().waitFor();
        await s.pause(1500);
        await s.reveal(b, 0.4);
        await s.click(b);
        await s.page.getByRole('dialog').waitFor();
        await settle(s, 500);
      },
    },
    {
      caption: 'Click **Reinstate account** to confirm.',
      run: async (s) => {
        await s.click(s.page.getByRole('dialog').getByRole('button', { name: 'Reinstate account' }));
        await s.page.getByText('Account reinstated.').first().waitFor();
        await settle(s, 1200);
      },
    },
  ],
};

export default episode;
