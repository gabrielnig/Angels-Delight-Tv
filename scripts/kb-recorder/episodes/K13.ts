import type { Episode } from '../episode';
import { goToScreen } from '../helpers';
import { clickAndLoad, pointAt, settle } from '../safety-helpers';

/** K13: start the deletion of a viewer account the owner asked to close. Super admin only. */
const episode: Episode = {
  id: 'K13',
  title: 'Delete an account when the owner asks',
  role: 'super_admin',
  screens: ['/admin/users', '/admin/users/[id]'],
  actions: ['users.delete'],
  dependsOn: ['apps/web/src/components/admin/UserDetail.tsx'],
  next: 'K06 Read the audit log: who did what',
  steps: [
    {
      caption: 'Choose **Users** in the side menu.',
      run: async (s) => {
        await goToScreen(s, 'Users');
        await s.page.getByRole('heading', { name: 'Users' }).first().waitFor();
      },
    },
    {
      caption: 'Type "kelechi" in the **Search by email or profile name** box.',
      run: async (s) => {
        await s.type(s.page.getByLabel('Search by email or profile name'), 'kelechi');
      },
    },
    {
      caption: 'Click **Search**.',
      run: async (s) => {
        await clickAndLoad(s, s.page.getByRole('button', { name: 'Search', exact: true }));
        await s.page.getByRole('link', { name: 'kelechi@example.test' }).first().waitFor();
        await settle(s, 600);
      },
    },
    {
      caption: 'Click **kelechi@example.test** to open the account.',
      run: async (s) => {
        await s.click(s.page.getByRole('link', { name: 'kelechi@example.test' }).first());
        await s.page.getByRole('heading', { name: 'Support actions' }).waitFor();
        await settle(s, 600);
      },
    },
    {
      caption: 'Scroll to **Support actions**.',
      note: 'Only a Super admin sees Delete account. Admins do not.',
      run: async (s) => {
        const h = s.page.getByRole('heading', { name: 'Support actions' });
        await s.reveal(h, 0.3);
        await pointAt(s, h);
      },
    },
    {
      caption: 'Click **Delete account**.',
      note: 'Use this only when the owner of the account asked for it.',
      run: async (s) => {
        await s.click(s.page.getByRole('button', { name: 'Delete account', exact: true }).first());
        await s.page.getByRole('dialog').waitFor();
        await settle(s, 500);
      },
      shot: {
        name: 'delete-box',
        alt: 'The Delete this account box with the Type DELETE to confirm box marked 1',
        marks: [{ target: (s) => s.page.getByRole('dialog').getByLabel('Type DELETE to confirm'), label: 'Type DELETE' }],
      },
    },
    {
      caption: 'Type "DELETE" in the **Type DELETE to confirm** box.',
      note: 'The red button stays off until you type the word in capital letters.',
      run: async (s) => {
        await s.type(s.page.getByRole('dialog').getByLabel('Type DELETE to confirm'), 'DELETE');
      },
    },
    {
      caption: 'Click **Delete account** to confirm.',
      note: 'The account closes now. The data is removed after a waiting period, and the owner can cancel by signing in.',
      run: async (s) => {
        await s.click(s.page.getByRole('dialog').getByRole('button', { name: 'Delete account' }));
        await s.page.getByText('Deletion started.').first().waitFor();
        await settle(s, 1200);
      },
    },
  ],
};

export default episode;
