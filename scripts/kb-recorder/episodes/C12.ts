import type { Episode } from '../episode';
import { goToScreen, scrollTo } from '../helpers';

const episode: Episode = {
  id: 'C12',
  title: 'Change a role, remove access, reset two step',
  role: 'super_admin',
  screens: ['/admin/roles'],
  actions: ['roles.change', 'roles.bulk'],
  dependsOn: ['apps/web/src/app/admin/(shell)/roles', 'apps/web/src/components/admin/RolesScreen.tsx'],
  next: 'C11 Invite a teammate',
  steps: [
    {
      caption: 'Choose **Roles and invites** in the side menu.',
      holdMs: 5000,
      run: async (s) => {
        await goToScreen(s, 'Roles and invites');
        await s.page.getByRole('heading', { name: 'Roles and invites' }).first().waitFor();
      },
      shot: {
        name: 'staff',
        alt: 'The staff list with the Role list of Demo Editor marked 1',
        marks: [{ target: (s) => s.page.getByLabel('Role for Demo Editor', { exact: true }), label: 'Role' }],
      },
    },
    {
      caption: 'Select **Admin** from the **Role for Demo Editor** list.',
      note: 'You cannot change your own role, and the last Super admin is protected.',
      holdMs: 5000,
      run: async (s) => {
        await s.click(s.page.getByLabel('Role for Demo Editor', { exact: true }));
        await s.page.getByLabel('Role for Demo Editor', { exact: true }).selectOption({ label: 'Admin' });
        await s.pause(800);
      },
    },
    {
      caption: 'Click **Reset two step sign in for Demo Admin**.',
      note: 'Do this when someone loses their phone and recovery codes. They are signed out and must set up again.',
      holdMs: 5000,
      run: async (s) => {
        await s.click(s.page.getByRole('button', { name: 'Reset two step sign in for Demo Admin', exact: true }));
        await s.page.getByRole('dialog').waitFor();
      },
      shot: {
        name: 'reset',
        alt: 'The reset box asking you to confirm',
        marks: [{ target: (s) => s.page.getByRole('dialog'), label: 'Confirm the reset' }],
      },
    },
  ],
};

export default episode;
