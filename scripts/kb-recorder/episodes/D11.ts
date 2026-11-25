import type { Episode } from '../episode';
import { lookStep, navStep, rowLink } from '../c1-common';
import { clickByName } from '../helpers';

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
    },
    navStep('Videos', 'Choose **Videos** in the side menu.'),
    lookStep(
      'Check that **Telling the Time** is back in the list.',
      (s) => s.page.getByRole('link', { name: 'Telling the Time', exact: true }).first(),
      { holdMs: 11400, shot: { name: 'back', alt: 'The video Telling the Time back in the Videos list, marked 1', label: 'Restored' } },
    ),
  ],
};

export default episode;
