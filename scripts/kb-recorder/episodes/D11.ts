import type { Episode } from '../episode';
import { navStep, rowLink } from '../c1-common';
import { clickByName, waitForToast } from '../helpers';

/** D11 Delete a video and restore it from Trash. Moving to Trash is an Admin task, so the episode runs as Admin. */
const episode: Episode = {
  id: 'D11',
  title: 'Delete a video and restore it from Trash',
  role: 'admin',
  screens: ['/admin/videos/trash'],
  actions: ['video.delete', 'video.restore'],
  covers: { nav: ['Trash'] },
  dependsOn: [
    'apps/web/src/components/admin/TrashList.tsx',
    'apps/web/src/components/admin/VideoEditor.tsx',
    'apps/web/src/app/admin/(shell)/videos/trash',
  ],
  next: 'D12 Watch the Encoding queue and retry a failed video',
  steps: [
    navStep('Videos', 'Choose **Videos** in the side menu.'),
    {
      caption: 'Click **Edit Telling the Time**.',
      holdMs: 1800,
      run: async (s) => {
        await s.click(rowLink(s, 'Edit Telling the Time', 'Telling the Time'));
        await s.page.getByRole('button', { name: 'Move to Trash', exact: true }).waitFor();
      },
    },
    {
      caption: 'Click **Move to Trash**.',
      note: 'Only Admins and Super admins can see this button turned on.',
      holdMs: 1800,
      run: async (s) => {
        await clickByName(s, 'button', 'Move to Trash', { exact: true });
        await s.page.getByRole('dialog').waitFor();
      },
      shot: {
        name: 'confirm',
        alt: 'The box that asks to move the video to Trash, with its button marked 1',
        marks: [{ target: (s) => s.page.getByRole('dialog').getByRole('button', { name: 'Move to Trash', exact: true }), label: 'Move to Trash' }],
      },
    },
    {
      caption: 'Click **Move to Trash** to confirm.',
      note: 'The video stops showing to viewers at once. You have 30 days to restore it.',
      holdMs: 1800,
      run: async (s) => {
        await s.click(s.page.getByRole('dialog').getByRole('button', { name: 'Move to Trash', exact: true }));
        await s.page.waitForURL(/\/admin\/videos$/);
      },
    },
    navStep('Trash', 'Choose **Trash** in the side menu.', {
      shot: { name: 'trash', alt: 'The Trash list with the video Telling the Time marked 1' },
    }),
    {
      caption: 'Click **Restore Telling the Time**.',
      holdMs: 1800,
      run: async (s) => {
        await s.page.waitForURL(/\/admin\/videos\/trash/, { timeout: 15000 });
        await clickByName(s, 'button', 'Restore Telling the Time', { exact: true });
      },
      shot: {
        name: 'restore',
        alt: 'The Restore button of the video marked 1',
        marks: [{ target: (s) => s.page.getByRole('button', { name: 'Restore Telling the Time', exact: true }), label: 'Restore' }],
      },
    },
    {
      caption: 'Wait until you see **was restored**.',
      holdMs: 3000,
      run: async (s) => {
        await waitForToast(s, 'was restored');
      },
    },
  ],
};

export default episode;
