import type { Episode } from '../episode';
import { goToScreen } from '../helpers';

const episode: Episode = {
  id: 'W13',
  title: 'Clean up Trash and failed encodes',
  role: 'editor',
  screens: ['/admin/videos/trash', '/admin/encoding/failed'],
  actions: ['video.restore', 'encode.retry'],
  covers: { nav: ['Trash'] },
  dependsOn: [
    'apps/web/src/app/admin/(shell)/videos/trash',
    'apps/web/src/app/admin/(shell)/encoding',
    'apps/web/src/components/admin/TrashList.tsx',
    'apps/web/src/components/admin/FailedEncodes.tsx',
  ],
  next: 'C14 System: jobs, storage and player quality',
  steps: [
    {
      caption: 'Click **Open in Encoding**.',
      note: 'It is in Needs attention on the Dashboard. You can also open Encoding in the side menu.',
      run: async (s) => {
        await s.click(s.page.getByRole('link', { name: 'Open in Encoding', exact: true }));
        await s.page.getByRole('heading', { name: 'Encoding queue' }).waitFor();
      },
      shot: {
        name: 'queue',
        alt: 'The Encoding queue with the Failed encodes button marked 1',
        marks: [{ target: (s) => s.page.getByRole('link', { name: 'Failed encodes', exact: true }), label: 'Failed encodes' }],
      },
    },
    {
      caption: 'Click **Failed encodes**.',
      run: async (s) => {
        await s.click(s.page.getByRole('link', { name: 'Failed encodes', exact: true }));
        await s.page.getByRole('heading', { name: 'Failed encodes' }).first().waitFor();
      },
      shot: {
        name: 'failed',
        alt: 'The Failed encodes page with the Clean up all button marked 1, greyed out when nothing is left over',
        marks: [{ target: (s) => s.page.getByRole('button', { name: 'Clean up all' }), label: 'Clean up all' }],
      },
    },
    {
      caption: 'Click **Retry Our Solar System**.',
      note: 'Retry starts the video again from your original file. If a retry keeps failing, use Clean up all to clear the half made files first.',
      run: async (s) => {
        await s.click(s.page.getByRole('button', { name: 'Retry Our Solar System', exact: true }));
        await s.pause(1200);
      },
      shot: {
        name: 'retry',
        alt: 'The Failed encodes list with the Retry button for Our Solar System marked 1',
        marks: [{ target: (s) => s.page.getByRole('button', { name: 'Retry Our Solar System', exact: true }), label: 'Retry' }],
      },
    },
    {
      caption: 'Choose **Trash** in the side menu.',
      note: 'Videos wait here for 30 days before they are deleted for good.',
      run: async (s) => {
        await goToScreen(s, 'Trash');
        await s.page.getByRole('heading', { name: 'Trash' }).first().waitFor();
      },
      shot: {
        name: 'trash',
        alt: 'The Trash list with the Days left column marked 1',
        marks: [{ target: (s) => s.page.getByRole('columnheader', { name: 'Days left' }), label: 'Days left' }],
      },
    },
    {
      caption: 'Click **Restore Test clip**.',
      note: 'A restored video comes back as a draft. Nothing is published until you choose Publish.',
      run: async (s) => {
        await s.click(s.page.getByRole('button', { name: 'Restore Test clip' }));
        await s.page.getByRole('button', { name: 'Restore Test clip' }).waitFor({ state: 'detached' });
      },
      shot: {
        name: 'restore',
        alt: 'The Trash list after a video was restored, with Delete forever for the other video marked 1',
        marks: [
          {
            target: (s) => s.page.getByRole('button', { name: 'Delete forever: Welcome Video (old cut)' }),
            label: 'Delete forever, for Admins only',
          },
        ],
      },
    },
  ],
};

export default episode;
