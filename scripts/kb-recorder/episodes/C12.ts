import type { Episode } from '../episode';
import { clickByName, goToScreen, highlight, padSteps, typeInto } from '../c3-helpers';

const episode: Episode = {
  id: 'C12',
  title: 'Change a role, remove access, reset two step',
  role: 'super_admin',
  screens: [],
  actions: ['roles.bulk'],
  dependsOn: ['apps/web/src/components/admin/RolesInvites.tsx'],
  next: 'C13 Your own account',
  steps: padSteps([
    {
      caption: 'Click **Roles and invites** in the side menu.',
      run: async (s) => { await goToScreen(s, 'Roles and invites'); await s.page.getByRole('heading', { name: 'Roles and invites' }).first().waitFor(); },
    },
    {
      caption: 'Check the **Role** column of the staff list.',
      note: 'You cannot change your own role. The only Super admin is locked, so make someone else a Super admin first.',
      run: async (s) => highlight(s, s.page.getByRole('columnheader', { name: 'Role' }), 2000),
      shot: {
        name: 'people',
        alt: 'The staff table with the Role column marked 1',
        marks: [{ target: (s) => s.page.getByRole('columnheader', { name: 'Role' }), label: 'Role' }],
      },
    },
    {
      caption: 'Select **Admin** from the **Role for Demo Editor** list.',
      run: async (s) => {
        const sel = s.page.getByLabel('Role for Demo Editor', { exact: true }).first();
        await s.click(sel);
        await sel.selectOption({ label: 'Admin' });
        await s.page.getByRole('dialog').waitFor();
      },
    },
    {
      caption: 'Click **Change role** to confirm.',
      note: 'The box explains what the new role can do. The person gets the new role the next time they open the admin.',
      run: async (s) => { await clickByName(s, 'button', 'Change role'); await s.pause(1500); },
    },
    {
      caption: 'Click **Reset two step sign in for Demo Admin**.',
      note: 'Use this when someone loses their phone. They are signed out everywhere, their remembered devices are forgotten, and they sign in again with an emailed code.',
      run: async (s) => { await clickByName(s, 'button', 'Reset two step sign in for Demo Admin'); await s.page.getByRole('dialog').waitFor(); },
      shot: {
        name: 'reset',
        alt: 'The reset box with the Email me a code instead button marked 1',
        marks: [{ target: (s) => s.page.getByRole('button', { name: 'Email me a code instead' }), label: 'Email me a code' }],
      },
    },
    {
      caption: 'Click **Email me a code instead**.',
      note: 'Use this when you sign in with emailed codes. We send a code to your own address. App users skip this and type the app code.',
      run: async (s) => { await clickByName(s, 'button', 'Email me a code instead'); await s.page.getByLabel('Your emailed code', { exact: true }).waitFor(); },
    },
    {
      caption: 'Type "123456" in the **Your emailed code** box.',
      note: 'This is your own code, not theirs. In this demo the code is 123456.',
      run: async (s) => typeInto(s, 'Your emailed code', '123456'),
    },
    {
      caption: 'Click **Reset** to confirm.',
      run: async (s) => { await s.click(s.page.getByRole('dialog').getByRole('button', { name: 'Reset', exact: true })); await s.pause(1500); },
    },
  ]),
};
export default episode;
