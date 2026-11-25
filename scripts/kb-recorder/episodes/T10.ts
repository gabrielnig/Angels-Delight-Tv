import type { Episode } from '../episode';
import { highlight } from '../helpers';
import { menuTo, slow } from '../helpers-c7';

/** T10: storage is nearly full. Read System, then find Trash to free space. */
const episode: Episode = {
  id: 'T10',
  title: 'Storage is nearly full',
  role: 'admin',
  screens: ['/admin/system'],
  actions: ['system.view', 'video.purge'],
  covers: { nav: ['System'] },
  dependsOn: ['apps/web/src/components/admin/SystemView.tsx', 'apps/web/src/components/admin/TrashList.tsx'],
  steps: [
    {
      caption: 'Choose **System** in the side menu.',
      run: async (s) => {
        await menuTo(s, 'System');
        await s.page.getByRole('heading', { name: 'System' }).first().waitFor();
      },
    },
    {
      caption: 'Click **Storage**.',
      run: async (s) => {
        await s.click(s.page.getByRole('tab', { name: 'Storage' }));
        await s.page.getByText(/Storage used/).first().waitFor();
      },
    },
    {
      caption: 'Check the **Storage used** figure and the warning under it.',
      note: 'The warning appears at 80 percent of your storage budget, or when the pace of uploads will reach it within 30 days.',
      run: async (s) => {
        await highlight(s, s.page.getByText(/Storage is over your budget|Storage has reached 80 percent/).first());
      },
      shot: {
        name: 'storage',
        alt: 'The Storage tab with the budget warning marked 1',
        marks: [
          {
            target: (s) => s.page.getByText(/Storage is over your budget|Storage has reached 80 percent/).first(),
            label: 'Budget warning',
          },
        ],
      },
    },
    {
      caption: 'Check the **Videos** figure in the breakdown.',
      run: async (s) => {
        await highlight(s, s.page.getByText('Videos', { exact: true }).first());
      },
    },
    {
      caption: 'Choose **Trash** in the side menu.',
      run: async (s) => {
        await menuTo(s, 'Trash');
        await s.page.getByRole('heading', { name: 'Trash' }).first().waitFor();
      },
    },
    {
      caption: 'Scroll to **Delete forever** next to a video you do not need.',
      note: 'Deleting forever cannot be undone, and it frees the space after a short time. Only Admins can do it.',
      run: async (s) => {
        await highlight(s, s.page.getByRole('button', { name: /Delete forever: Test clip/ }));
      },
      shot: {
        name: 'trash',
        alt: 'The Trash list with Delete forever marked 1',
        marks: [{ target: (s) => s.page.getByRole('button', { name: /Delete forever: Test clip/ }), label: 'Delete forever' }],
      },
    },
  ],
};

export default slow(episode, 1800);
