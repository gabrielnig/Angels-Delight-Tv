import type { Episode } from '../episode';
import { clickByName, goToScreen, highlight, padSteps, typeInto } from '../c3-helpers';

const episode: Episode = {
  id: 'C11',
  title: 'Invite a teammate and choose their role',
  role: 'super_admin',
  screens: ['/admin/roles'],
  actions: ['roles.view', 'roles.change'],
  covers: { nav: ['Roles and invites'] },
  dependsOn: ['apps/web/src/components/admin/RolesInvites.tsx', 'apps/web/src/app/admin/(shell)/roles'],
  next: 'C12 Change a role, reset two step',
  steps: padSteps([
    {
      caption: 'Click **Roles and invites** in the side menu.',
      note: 'Only Super admins see this screen.',
      run: async (s) => { await goToScreen(s, 'Roles and invites'); await s.page.getByRole('heading', { name: 'Roles and invites' }).first().waitFor(); },
      shot: {
        name: 'roles',
        alt: 'The Roles and invites screen with the invite form marked 1',
        marks: [{ target: (s) => s.page.getByRole('heading', { name: 'Invite a team member' }), label: 'Invite form' }],
      },
    },
    {
      caption: 'Type "amaka@example.org" in the **Email** box.',
      run: async (s) => typeInto(s, 'Email', 'amaka@example.org'),
    },
    {
      caption: 'Select **Admin** from the **Role** list.',
      note: 'Editor looks after videos and Home. Admin also sets the look, pages and accounts. Super admin also controls the team and the switches.',
      run: async (s) => {
        const sel = s.page.getByLabel('Role', { exact: true });
        await s.click(sel);
        await sel.selectOption({ label: 'Admin' });
        await s.pause(500);
      },
    },
    {
      caption: 'Click **Send invite**.',
      note: 'The link in the email works for 7 days and can be used once.',
      run: async (s) => { await clickByName(s, 'button', 'Send invite'); await s.page.getByText('amaka@example.org').first().waitFor(); },
    },
    {
      caption: 'Check **amaka@example.org** in the pending list.',
      run: async (s) => highlight(s, s.page.getByText('amaka@example.org').first(), 2200),
      shot: {
        name: 'pending',
        alt: 'The Pending invites list with the new invite marked 1',
        marks: [{ target: (s) => s.page.getByText('amaka@example.org').first(), label: 'New invite' }],
      },
    },
    {
      caption: 'Click **Resend invite to amaka@example.org**.',
      note: 'Use this when the email did not arrive. Ask them to check their spam folder first.',
      run: async (s) => { await clickByName(s, 'button', 'Resend invite to amaka@example.org'); await s.pause(1200); },
    },
    {
      caption: 'Click **Cancel invite to amaka@example.org**.',
      note: 'Cancel an invite sent to the wrong address. The link stops working.',
      run: async (s) => { await clickByName(s, 'button', 'Cancel invite to amaka@example.org'); await s.page.getByRole('dialog').waitFor(); },
    },
    {
      caption: 'Click **Cancel invite** to confirm.',
      run: async (s) => { await s.click(s.page.getByRole('dialog').getByRole('button', { name: 'Cancel invite', exact: true })); await s.pause(1200); },
    },
  ]),
};
export default episode;
