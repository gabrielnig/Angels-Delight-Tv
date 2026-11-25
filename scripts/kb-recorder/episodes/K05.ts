import type { Episode } from '../episode';
import { goToScreen } from '../helpers';
import { clickAndLoad, pointAt, settle } from '../safety-helpers';

/** K05: reset a viewer's two step sign in after they lost their phone and their recovery codes. */
const episode: Episode = {
  id: 'K05',
  title: "Reset a viewer's two step sign in and delete an account on request",
  role: 'admin',
  screens: ['/admin/users', '/admin/users/[id]'],
  actions: ['users.suspend'],
  dependsOn: ['apps/web/src/components/admin/UserDetail.tsx'],
  next: 'K13 Delete an account when the owner asks',
  steps: [
    {
      caption: 'Choose **Users** in the side menu.',
      run: async (s) => {
        await goToScreen(s, 'Users');
        await s.page.getByRole('heading', { name: 'Users' }).first().waitFor();
      },
    },
    {
      caption: 'Type "tunde" in the **Search by email or profile name** box.',
      note: 'Check that the email is the one the owner wrote from, before you change anything.',
      run: async (s) => {
        await s.type(s.page.getByLabel('Search by email or profile name'), 'tunde');
      },
    },
    {
      caption: 'Click **Search**.',
      run: async (s) => {
        await clickAndLoad(s, s.page.getByRole('button', { name: 'Search', exact: true }));
        await s.page.getByRole('link', { name: 'tunde@example.test' }).first().waitFor();
        await settle(s, 600);
      },
    },
    {
      caption: 'Click **tunde@example.test** to open the account.',
      run: async (s) => {
        await s.click(s.page.getByRole('link', { name: 'tunde@example.test' }).first());
        await s.page.getByRole('heading', { name: 'Support actions' }).waitFor();
        await settle(s, 600);
      },
    },
    {
      caption: 'Scroll to **Support actions**.',
      note: 'Each action asks for a reason and is written to the audit log.',
      run: async (s) => {
        const h = s.page.getByRole('heading', { name: 'Support actions' });
        await s.reveal(h, 0.3);
        await pointAt(s, h);
      },
    },
    {
      caption: 'Click **Reset two step verification**.',
      note: 'Use this only after you are sure the person is the owner, for example by the support email.',
      run: async (s) => {
        await s.click(s.page.getByRole('button', { name: 'Reset two step verification', exact: true }).first());
        await s.page.getByRole('dialog').waitFor();
        await settle(s, 500);
      },
      shot: {
        name: 'reset-box',
        alt: 'The Reset two step verification box with the Reason box marked 1',
        marks: [{ target: (s) => s.page.getByRole('dialog').getByLabel('Reason'), label: 'Reason' }],
      },
    },
    {
      caption: 'Type "Lost phone and codes, owner confirmed by email" in the **Reason** box.',
      run: async (s) => {
        await s.type(
          s.page.getByRole('dialog').getByLabel('Reason'),
          'Lost phone and codes, owner confirmed by email',
        );
      },
    },
    {
      caption: 'Click **Reset two step verification** to confirm.',
      note: 'The person is signed out everywhere and gets an email. They set up two step sign in again after they sign in.',
      run: async (s) => {
        await s.click(
          s.page.getByRole('dialog').getByRole('button', { name: 'Reset two step verification' }),
        );
        await s.page.getByText('Two step verification reset.').first().waitFor();
        await settle(s, 1200);
      },
    },
  ],
};

export default episode;
