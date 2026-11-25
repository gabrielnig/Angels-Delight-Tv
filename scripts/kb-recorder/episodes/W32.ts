import type { Episode } from '../episode';
import { goToScreen } from '../helpers';

/** Retry several failed encodes from the Encoding queue. */
const episode: Episode = {
  id: 'W32',
  title: 'Retry many failed encodes at once',
  role: 'editor',
  screens: ['/admin/encoding'],
  covers: { nav: ['Encoding'] },
  dependsOn: ['apps/web/src/components/admin/EncodingQueue.tsx'],
  next: 'W33 Upload many videos and set the details together',
  steps: [
    {
      caption: 'Choose **Encoding** in the side menu.',
      run: async (s) => {
        await goToScreen(s, 'Encoding');
      },
    },
    {
      caption: 'Tick **Select all on this page**.',
      run: async (s) => {
        await s.click(s.page.getByLabel(/^Select all/).first());
      },
      shot: {
        name: 'selected',
        alt: 'The queue with failed rows ticked and the Retry button in the bar, marked 1',
        marks: [
          {
            target: (s) => s.page.getByRole('button', { name: /^Retry \d+ failed/ }),
            label: 'Retry',
          },
        ],
      },
    },
    {
      caption: 'Click **Retry** in the bar.',
      run: async (s) => {
        await s.click(s.page.getByRole('button', { name: /^Retry \d+ failed/ }));
        await s.page.getByRole('dialog').waitFor();
      },
    },
    {
      caption: 'Click **Retry** in the box to confirm.',
      run: async (s) => {
        await s.click(s.page.getByRole('dialog').getByRole('button', { name: /^Retry \d/ }));
        await s.pause(1200);
      },
    },
  ],
};
export default episode;
