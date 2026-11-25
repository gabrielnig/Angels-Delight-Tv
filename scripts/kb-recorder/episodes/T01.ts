import type { Episode } from '../episode';
import { clickByName, highlight } from '../helpers';
import { menuTo, slow } from '../helpers-c7';

/** T01: a video is stuck on Encoding, or says Failed. Check, read the reason, Retry. */
const episode: Episode = {
  id: 'T01',
  title: 'A video is stuck on Encoding',
  role: 'editor',
  screens: ['/admin/encoding', '/admin/encoding/failed'],
  actions: ['encode.retry'],
  covers: { nav: ['Encoding'], statuses: ['video:encoding', 'video:failed'] },
  dependsOn: [
    'apps/web/src/components/admin/EncodingQueue.tsx',
    'apps/web/src/components/admin/FailedEncodes.tsx',
    'apps/web/src/app/admin/(shell)/encoding',
  ],
  viewports: ['desktop', 'mobile'],
  steps: [
    {
      caption: 'Choose **Encoding** in the side menu.',
      note: 'Editors and above can open this page. It updates by itself every few seconds.',
      run: async (s) => {
        await menuTo(s, 'Encoding');
        await s.page.getByRole('heading', { name: 'Encoding' }).first().waitFor();
      },
      shot: {
        name: 'queue',
        alt: 'The Encoding queue with one video preparing and one that failed',
        marks: [
          {
            target: (s) => s.page.getByRole('list', { name: 'Encoding jobs' }),
            label: 'The queue',
          },
        ],
      },
    },
    {
      caption: 'Check the **Failed encodes** section.',
      run: async (s) => {
        await highlight(s, s.page.getByRole('link', { name: 'Rivers of Africa' }).first());
      },
    },
    {
      caption: 'Check the **Processing** badge for your video.',
      note: 'A long video can stay on one stage for several minutes. This is normal.',
      run: async (s) => {
        await highlight(
          s,
          s.page.getByText(/Making streaming sizes|Checking the file|Final checks|Waiting to start/).first(),
        );
      },
      shot: {
        name: 'progress',
        alt: 'The stage text and progress bar under a video title, marked 1',
        marks: [
          {
            target: (s) => s.page.getByRole('progressbar', { name: /Encoding Rivers of Africa/ }),
            label: 'Progress',
          },
        ],
      },
    },
    {
      caption: 'Wait until **Processing** shows the progress bar moving.',
      holdMs: 2500,
      run: async (s) => {
        await highlight(s, s.page.getByRole('list', { name: 'Encoding jobs' }), 2000);
      },
    },
    {
      caption: 'Scroll to **Failed** in the list.',
      run: async (s) => {
        await highlight(s, s.page.getByRole('link', { name: 'Our Solar System' }).first());
      },
    },
    {
      caption: 'Check that **It did not finish** appears in the red box.',
      note: 'Your original file is safe. A failed encode never deletes it.',
      run: async (s) => {
        await highlight(s, s.page.getByText(/The audio track could not be read/).first());
      },
      shot: {
        name: 'failed',
        alt: 'A failed video with the reason in a red box and the Retry button marked 1',
        marks: [
          {
            target: (s) => s.page.getByRole('button', { name: /Retry encoding Our Solar System/ }),
            label: 'Retry',
          },
        ],
      },
    },
    {
      caption: 'Click **Retry encoding Our Solar System**.',
      run: async (s) => {
        await clickByName(s, 'button', /Retry encoding Our Solar System/);
        await s.pause(2500);
      },
    },
  ],
};

export default slow(episode, 1500);
