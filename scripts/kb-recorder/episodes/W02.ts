import type { Episode } from '../episode';
import { clickByName, goToScreen, waitForToast } from '../helpers';

/** Reorder lessons with Up and Down in the Genesis series. */
const episode: Episode = {
  id: 'W02',
  title: 'Reorder episodes and seasons',
  role: 'editor',
  screens: ['/admin/series/[id]'],
  actions: ['series.manage'],
  dependsOn: ['apps/web/src/components/admin/SeriesEditor.tsx'],
  next: 'W24 Move a lesson to another group and rename groups',
  steps: [
    {
      caption: 'Choose **Series** in the side menu.',
      run: async (s) => {
        await goToScreen(s, 'Series');
      },
    },
    {
      caption: 'Click **Demo series: Genesis** in the list.',
      run: async (s) => {
        await clickByName(s, 'link', 'Demo series: Genesis');
        await s.page.getByRole('heading', { name: 'Lessons' }).waitFor();
      },
    },
    {
      caption: 'Click **Move Demo lesson: Genesis 6, Noah and the ark up**.',
      run: async (s) => {
        await clickByName(s, 'button', 'Move Demo lesson: Genesis 6, Noah and the ark up');
        await waitForToast(s, 'Order saved.');
      },
      shot: {
        name: 'moved',
        alt: 'The Noah lesson now above the Adam and Eve lesson, with its Up button marked 1',
        marks: [
          {
            target: (s) =>
              s.page.getByRole('button', {
                name: 'Move Demo lesson: Genesis 6, Noah and the ark up',
              }),
            label: 'Up',
          },
        ],
      },
    },
    {
      caption: 'Click **Move Demo lesson: Genesis 6, Noah and the ark down**.',
      run: async (s) => {
        await clickByName(s, 'button', 'Move Demo lesson: Genesis 6, Noah and the ark down');
        await waitForToast(s, 'Order saved.');
      },
    },
  ],
};
export default episode;
