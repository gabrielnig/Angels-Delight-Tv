import type { Episode } from '../episode';
import { goToScreen } from '../helpers';
import { pointAt, settle } from '../safety-helpers';

/** K11: read the table of what each staff role can do. Super admin only. */
const episode: Episode = {
  id: 'K11',
  title: 'Who can do what: staff roles in plain words',
  role: 'super_admin',
  screens: ['/admin/roles'],
  actions: ['roles.view'],
  covers: { nav: ['Roles and invites'] },
  dependsOn: ['apps/web/src/components/admin/RolesInvites.tsx', 'apps/web/src/lib/admin/can-labels.ts'],
  next: 'K07 Keep the admin safe',
  steps: [
    {
      caption: 'Choose **Roles and invites** in the side menu.',
      note: 'Only a Super admin can open this screen.',
      run: async (s) => {
        await goToScreen(s, 'Roles and invites');
        await s.page.getByRole('heading', { name: 'Roles and invites' }).first().waitFor();
      },
    },
    {
      caption: 'Scroll to **Admins**.',
      note: 'This list holds every person with admin access, with their role and whether two step sign in is on.',
      run: async (s) => {
        const h = s.page.getByRole('heading', { name: 'Admins' });
        await s.reveal(h, 0.25);
        await pointAt(s, h);
      },
      shot: {
        name: 'staff-list',
        alt: 'The Admins list with the Role column marked 1',
        marks: [{ target: (s) => s.page.getByRole('columnheader', { name: 'Role' }).first(), label: 'Role' }],
      },
    },
    {
      caption: 'Scroll to **Invite a team member**.',
      note: 'To add or remove people, read the guides for inviting and changing roles.',
      run: async (s) => {
        const h = s.page.getByRole('heading', { name: 'Invite a team member' });
        await s.reveal(h, 0.25);
        await pointAt(s, h);
      },
    },
    {
      caption: 'Scroll to **What each role can do**.',
      run: async (s) => {
        const h = s.page.getByRole('heading', { name: 'What each role can do' });
        await s.reveal(h, 0.15);
        await pointAt(s, h);
      },
      shot: {
        name: 'role-table',
        alt: 'The table of what each role can do, with the Editor, Admin and Super admin columns marked 1',
        marks: [
          { target: (s) => s.page.getByRole('columnheader', { name: 'Editor' }), label: 'Editor' },
          { target: (s) => s.page.getByRole('columnheader', { name: 'Admin', exact: true }), label: 'Admin' },
          { target: (s) => s.page.getByRole('columnheader', { name: 'Super admin' }), label: 'Super admin' },
        ],
      },
    },
    {
      caption: 'Scroll to **Move videos to Trash**.',
      note: 'Editors can upload, edit and publish, but they cannot move a video to Trash.',
      run: async (s) => {
        const r = s.page.getByRole('rowheader', { name: 'Move videos to Trash' });
        await s.reveal(r, 0.4);
        await pointAt(s, r);
      },
    },
    {
      caption: 'Scroll to **Suspend viewer accounts**.',
      note: 'Admins and Super admins can suspend a viewer. Editors cannot see viewer accounts at all.',
      run: async (s) => {
        const r = s.page.getByRole('rowheader', { name: 'Suspend viewer accounts' });
        await s.reveal(r, 0.4);
        await pointAt(s, r);
      },
    },
    {
      caption: 'Scroll to **Change features and limits**.',
      note: 'Only Super admins can change features and limits.',
      run: async (s) => {
        const r = s.page.getByRole('rowheader', { name: 'Change features and limits' });
        await s.reveal(r, 0.4);
        await pointAt(s, r);
      },
    },
    {
      caption: 'Scroll to **Export the audit log**.',
      note: 'Only Super admins can export the audit log or read its security entries.',
      run: async (s) => {
        const r = s.page.getByRole('rowheader', { name: 'Export the audit log' });
        await s.reveal(r, 0.4);
        await pointAt(s, r);
      },
    },
  ],
};

export default episode;
