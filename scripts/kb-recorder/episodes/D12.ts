import type { Episode } from '../episode';
import { lookStep, navStep } from '../c1-common';
import { clickByName, waitForToast } from '../helpers';

/** D12 Watch the Encoding queue and retry a failed video. */
const episode: Episode = {
  id: 'D12',
  title: 'Watch the Encoding queue and retry a failed video',
  role: 'editor',
  screens: ['/admin/encoding', '/admin/encoding/failed'],
  actions: ['encode.retry', 'video.edit'],
  covers: { nav: ['Encoding'], statuses: ['video:encoding', 'video:failed'] },
  dependsOn: [
    'apps/web/src/components/admin/EncodingQueue.tsx',
    'apps/web/src/components/admin/FailedEncodes.tsx',
    'apps/web/src/app/admin/(shell)/encoding',
  ],
  viewports: ['desktop', 'mobile'],
  next: 'S06 Your first video from start to finish',
  steps: [
    navStep('Encoding', 'Choose **Encoding** in the side menu.', {
      heading: 'Encoding queue',
      shot: { name: 'queue', alt: 'The Encoding queue with the list of videos marked 1' },
    }),
    lookStep(
      'Check that **Updating live** is shown.',
      (s) => s.page.getByText('Updating live').first(),
      { shot: { name: 'live', alt: 'The Updating live note marked 1', label: 'Updating live' } },
    ),
    lookStep(
      'Check that **Rivers of Africa** shows its progress.',
      (s) => s.page.getByRole('link', { name: 'Rivers of Africa', exact: true }),
      { shot: { name: 'progress', alt: 'A video with its progress bar marked 1', label: 'Progress' } },
    ),
    lookStep(
      'Check that **It did not finish** explains why a video failed.',
      (s) => s.page.getByText('It did not finish').first(),
      { holdMs: 3000, shot: { name: 'failed', alt: 'The reason a video failed, marked 1', label: 'Why it failed' } },
    ),
    {
      caption: 'Click **Retry encoding Our Solar System**.',
      note: 'The button on your screen carries the name of your own video.',
      holdMs: 1800,
      run: async (s) => {
        await clickByName(s, 'button', 'Retry encoding Our Solar System', { exact: true });
      },
    },
    {
      caption: 'Wait until you see **is back in the queue**.',
      holdMs: 16000,
      run: async (s) => {
        await waitForToast(s, 'is back in the queue');
      },
      shot: {
        name: 'retried',
        alt: 'The message that the video is back in the queue, marked 1',
        marks: [{ target: (s) => s.page.getByText('is back in the queue').first(), label: 'Back in the queue' }],
      },
    },
  ],
};

export default episode;
