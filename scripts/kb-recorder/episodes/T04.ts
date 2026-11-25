import type { Episode } from '../episode';
import { highlight } from '../helpers';
import { menuTo, slow } from '../helpers-c7';

/** T04: viewers say a video will not play. Check it is published and finished, then look as a viewer. */
const episode: Episode = {
  id: 'T04',
  title: 'Viewers say a video will not play',
  role: 'editor',
  screens: ['/admin/videos'],
  actions: ['video.edit'],
  covers: { nav: ['Videos'], statuses: ['publish:published', 'publish:unpublished'] },
  dependsOn: [
    'apps/web/src/components/admin/VideosList.tsx',
    'apps/web/src/components/admin/VideoEditor.tsx',
  ],
  steps: [
    {
      caption: 'Choose **Videos** in the side menu.',
      run: async (s) => {
        await menuTo(s, 'Videos');
        await s.page.getByRole('heading', { name: 'Videos' }).first().waitFor();
      },
    },
    {
      caption: 'Check the **Search** box above the video list.',
      run: async (s) => {
        await highlight(s, s.page.getByText('Staying Safe Online').first());
      },
    },
    {
      caption: 'Check the **Status** badge.',
      note: 'Only a video marked Published can be watched by viewers.',
      run: async (s) => {
        await highlight(s, s.page.getByRole('columnheader', { name: 'Status' }));
      },
      shot: {
        name: 'status',
        alt: 'The Videos list with the Status column marked 1',
        marks: [
          {
            target: (s) => s.page.getByRole('columnheader', { name: 'Status' }),
            label: 'Status',
          },
        ],
      },
    },
  ],
};

export default slow(episode, 7000);
