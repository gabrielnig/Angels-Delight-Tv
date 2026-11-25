import type { Episode } from '../episode';
import { goToScreen, scrollTo } from '../helpers';

const episode: Episode = {
  id: 'C11',
  title: 'Invite a teammate and choose their role',
  role: 'super_admin',
  screens: ['/admin/roles'],
  actions: ['roles.view', 'roles.change'],
  covers: {'nav': ['Roles and invites']},
  dependsOn: ['apps/web/src/app/admin/(shell)/roles', 'apps/web/src/components/admin/RolesScreen.tsx'],
  next: 'C12 Change a role, remove access, reset two step',
  steps: [
    {
      caption: 'Choose **Roles and invites** in the side menu.',
      note: 'Only a Super admin can see this page.',
      run: async (s) => {
        await goToScreen(s, 'Roles and invites');
        await s.page.getByRole('heading', { name: 'Roles and invites' }).first().waitFor();
      },
      shot: {
        name: 'roles',
        alt: 'The Roles and invites page with the staff list marked 1',
        marks: [{ target: (s) => s.page.getByRole('heading', { name: 'Admins' }), label: 'Your team' }],
      },
    },
    {
      caption: 'Scroll to **Invite a team member**.',
      run: async (s) => {
        await scrollTo(s, s.page.getByText('Invite a team member').first());
      },
    },
    {
      caption: 'Type "newteam@example.test" in the **Email** box.',
      note: 'Use the address they read email on. They get the invite there.',
      run: async (s) => {
        await s.type(s.page.getByLabel('Email', { exact: true }), 'newteam@example.test');
      },
    },
    {
      caption: 'Select **Editor** from the **Role** list.',
      note: 'Editor looks after videos. Admin also sets the look and handles accounts.',
      run: async (s) => {
        await s.click(s.page.getByLabel('Role', { exact: true }));
        await s.page.getByLabel('Role', { exact: true }).selectOption({ label: 'Editor' });
      },
      shot: {
        name: 'invite',
        alt: 'The invite form with the Role list marked 1',
        marks: [{ target: (s) => s.page.getByLabel('Role', { exact: true }), label: 'Role' }],
      },
    },
    {
      caption: 'Click **Send invite**.',
      note: 'They have a limited time to accept. Use Resend invite or Cancel invite in Pending invites.',
      run: async (s) => {
        await s.click(s.page.getByRole('button', { name: 'Send invite', exact: true }));
        await s.page.getByText('newteam@example.test').first().waitFor();
      },
      shot: {
        name: 'sent',
        alt: 'The Pending invites list with the new invite marked 1',
        marks: [{ target: (s) => s.page.getByText('newteam@example.test').first(), label: 'New invite' }],
      },
    },
  ],
};

export default episode;
