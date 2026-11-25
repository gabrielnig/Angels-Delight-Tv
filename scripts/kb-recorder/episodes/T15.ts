import type { Episode } from '../episode';
import { highlight, waitForToast } from '../helpers';
import { menuTo, slow } from '../helpers-c7';

/** T15: emails are not arriving. A Super admin reads the failed email job on System and retries it. */
const episode: Episode = {
  id: 'T15',
  title: 'Emails are not arriving',
  role: 'super_admin',
  screens: ['/admin/system'],
  actions: ['system.jobs'],
  covers: { nav: ['System'] },
  dependsOn: ['apps/web/src/components/admin/SystemView.tsx', 'apps/web/src/app/admin/(shell)/system'],
  steps: [
    {
      caption: 'Choose **System** in the side menu.',
      run: async (s) => {
        await menuTo(s, 'System');
        await s.page.getByRole('heading', { name: 'System' }).first().waitFor();
      },
    },
    {
      caption: 'Check the **Jobs** tab.',
      run: async (s) => {
        await s.click(s.page.getByRole('tab', { name: /^Jobs/ }));
      },
    },
    {
      caption: 'Scroll to **Email** in the jobs table.',
      run: async (s) => {
        await highlight(s, s.page.getByRole('row', { name: /Email:/ }));
      },
      shot: {
        name: 'email-job',
        alt: 'The failed email job row with the reason marked 1 and Retry marked 2',
        marks: [
          { target: (s) => s.page.getByRole('row', { name: /Email:/ }).getByRole('cell').nth(1), label: 'The reason' },
          { target: (s) => s.page.getByRole('button', { name: /Retry Email/ }), label: 'Retry' },
        ],
      },
    },
    {
      caption: 'Check the **What went wrong** text for that email.',
      note: 'The mail service refused the message is the usual sign that the email service is not set up or its key has stopped working. Tell ARKDEV.',
      run: async (s) => {
        await highlight(s, s.page.getByText('The mail service refused the message.'));
      },
    },
    {
      caption: 'Click **Retry Email for Invite to sade@example.test**.',
      run: async (s) => {
        await s.click(s.page.getByRole('button', { name: /Retry Email/ }));
        await waitForToast(s, /Job queued again/);
      },
    },
  ],
};

export default slow(episode, 3200);
