import type { Episode } from '../episode';
import { highlight } from '../helpers';
import { menuTo, slow } from '../helpers-c7';

/** T07: I changed something by mistake. Restore a video from Trash, and find Restore previous on Home curation. */
const episode: Episode = {
  id: 'T07',
  title: 'I changed something by mistake',
  role: 'editor',
  screens: ['/admin/videos/trash', '/admin/home'],
  actions: ['video.restore', 'home.curate'],
  covers: { nav: ['Trash'] },
  dependsOn: [
    'apps/web/src/components/admin/TrashList.tsx',
    'apps/web/src/components/admin/HomeCuration.tsx',
  ],
  steps: [
    {
      caption: 'Choose **Trash** in the side menu.',
      run: async (s) => {
        await menuTo(s, 'Trash');
        await s.page.getByRole('heading', { name: 'Trash' }).first().waitFor();
      },
      shot: {
        name: 'trash',
        alt: 'The Trash list with the Restore button of the first video marked 1',
        marks: [
          {
            target: (s) => s.page.getByRole('button', { name: /Restore Welcome Video/ }).first(),
            label: 'Restore',
          },
        ],
      },
    },
    {
      caption: 'Check the **Deleted** column.',
      note: 'A video waits here for 30 days. After that it is gone for good.',
      run: async (s) => {
        await highlight(s, s.page.getByRole('columnheader', { name: 'Deleted' }).first());
      },
    },
    {
      caption: 'Click **Restore Welcome Video (old cut)**.',
      run: async (s) => {
        await s.click(s.page.getByRole('button', { name: /Restore Welcome Video/ }).first());
        await s.pause(2500);
      },
    },
    {
      caption: 'Choose **Home curation** in the side menu.',
      run: async (s) => {
        await menuTo(s, 'Home curation');
        await s.page.getByRole('heading', { name: 'Home curation' }).first().waitFor();
      },
    },
    {
      caption: 'Scroll to **Restore previous** at the top.',
      note: 'It puts back the version of Home that was live before your last publish. **Restore launch defaults** goes back to the first layout.',
      run: async (s) => {
        await highlight(s, s.page.getByRole('button', { name: 'Restore previous' }));
      },
      shot: {
        name: 'restore-previous',
        alt: 'The Home curation toolbar with Restore previous marked 1',
        marks: [
          {
            target: (s) => s.page.getByRole('button', { name: 'Restore previous' }),
            label: 'Restore previous',
          },
        ],
      },
    },
  ],
};

export default slow(episode, 4500);
