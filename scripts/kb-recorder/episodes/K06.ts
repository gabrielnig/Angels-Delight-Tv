import type { Episode } from '../episode';
import { goToScreen } from '../helpers';
import { clickAndLoad, pointAt, settle } from '../safety-helpers';

/** K06: filter the audit log and open one entry to see before and after. Admin; Super admin can also export. */
const episode: Episode = {
  id: 'K06',
  title: 'Read the audit log: who did what',
  role: 'admin',
  screens: ['/admin/audit-log'],
  actions: ['audit.read'],
  covers: { nav: ['Audit log'] },
  dependsOn: ['apps/web/src/components/admin/AuditLogView.tsx'],
  next: 'K07 Keep the admin safe',
  steps: [
    {
      caption: 'Choose **Audit log** in the side menu.',
      note: 'Admins see content actions. Super admins also see security entries.',
      run: async (s) => {
        await goToScreen(s, 'Audit log');
        await s.page.getByRole('heading', { name: 'Audit log' }).first().waitFor();
      },
      shot: {
        name: 'audit-log',
        alt: 'The Audit log table with the Who column marked 1',
        marks: [{ target: (s) => s.page.getByRole('columnheader', { name: 'Who' }), label: 'Who did it' }],
      },
    },
    {
      caption: 'Scroll to **Result**.',
      note: 'Done means it worked. Failed means it went wrong. Blocked means the role was not allowed.',
      run: async (s) => {
        const t = s.page.getByRole('columnheader', { name: 'Result' });
        await s.reveal(t, 0.3);
        await pointAt(s, t);
      },
    },
    {
      caption: 'Type "video." in the **Action** box.',
      note: 'Actions are written as a group and a verb, such as video.publish.',
      run: async (s) => {
        await s.type(s.page.getByLabel('Action', { exact: true }), 'video.');
      },
    },
    {
      caption: 'Click **Filter**.',
      run: async (s) => {
        await clickAndLoad(s, s.page.getByRole('button', { name: 'Filter', exact: true }));
        await s.page.getByRole('link', { name: /^Open details for video\.publish/ }).first().waitFor();
        await settle(s, 600);
      },
    },
    {
      caption: 'Click **Open details for video.publish at 10 Mar, 7:36** to open the entry.',
      run: async (s) => {
        await s.click(s.page.getByRole('link', { name: /^Open details for video\.publish/ }).first());
        await s.page.getByRole('heading', { name: /^Entry/ }).waitFor();
        await settle(s, 800);
      },
      shot: {
        name: 'entry',
        alt: 'The entry details with the Before and After columns marked 1',
        marks: [
          { target: (s) => s.page.getByRole('columnheader', { name: 'Before' }), label: 'Before' },
          { target: (s) => s.page.getByRole('columnheader', { name: 'After' }), label: 'After' },
        ],
      },
    },
    {
      caption: 'Scroll to **Before**.',
      note: 'Before and After show what changed. A password or a secret is never shown here.',
      run: async (s) => {
        const t = s.page.getByRole('columnheader', { name: 'Before' });
        await s.reveal(t, 0.3);
        await pointAt(s, t);
      },
    },
    {
      caption: 'Click **Close**.',
      run: async (s) => {
        await s.click(s.page.getByRole('link', { name: 'Close', exact: true }));
        await settle(s, 600);
      },
    },
    {
      caption: 'Click **Clear**.',
      note: 'Clear removes the filter and shows every entry again, newest first.',
      run: async (s) => {
        await s.click(s.page.getByRole('link', { name: 'Clear', exact: true }));
        await settle(s, 800);
      },
    },
  ],
};

export default episode;
