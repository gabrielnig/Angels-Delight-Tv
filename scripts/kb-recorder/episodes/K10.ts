import type { Episode } from '../episode';
import { goToScreen } from '../helpers';
import { pointAt, settle } from '../safety-helpers';

/** K10: take a video down fast: Unpublish, Move to Trash, then restore one from Trash. */
const episode: Episode = {
  id: 'K10',
  title: 'Take a video down quickly',
  role: 'admin',
  screens: ['/admin/videos/[id]', '/admin/videos/trash'],
  actions: ['video.publish', 'video.delete', 'video.restore', 'video.purge'],
  covers: { nav: ['Trash'] },
  dependsOn: [
    'apps/web/src/components/admin/VideoEditor.tsx',
    'apps/web/src/components/admin/TrashList.tsx',
  ],
  next: 'K04 Suspend an account and sign someone out everywhere',
  steps: [
    {
      caption: 'Choose **Videos** in the side menu.',
      run: async (s) => {
        await goToScreen(s, 'Videos');
        await s.page.getByRole('heading', { name: 'Videos' }).first().waitFor();
      },
    },
    {
      caption: 'Type "Telling" in the **Search** box.',
      run: async (s) => {
        await s.type(s.page.getByLabel('Search', { exact: true }).first(), 'Telling');
        await s.page.getByRole('link', { name: 'Telling the Time' }).first().waitFor();
        await s.pause(800);
      },
    },
    {
      caption: 'Click **Telling the Time** to open the video.',
      run: async (s) => {
        await s.click(s.page.getByRole('link', { name: 'Telling the Time' }).first());
        await s.page.getByRole('heading', { name: 'Details' }).waitFor();
        await settle(s);
      },
    },
    {
      caption: 'Click **Unpublish**.',
      note: 'Unpublish hides the video from viewers at once. You can publish it again any time.',
      run: async (s) => {
        await s.click(s.page.getByRole('button', { name: 'Unpublish', exact: true }).first());
        await s.page.getByRole('dialog').waitFor();
        await settle(s, 500);
      },
      shot: {
        name: 'unpublish-box',
        alt: 'The Unpublish box asking you to confirm, with the Unpublish button marked 1',
        marks: [
          {
            target: (s) => s.page.getByRole('dialog').getByRole('button', { name: 'Unpublish' }),
            label: 'Confirm',
          },
        ],
      },
    },
    {
      caption: 'Click **Unpublish** to confirm.',
      run: async (s) => {
        await s.click(s.page.getByRole('dialog').getByRole('button', { name: 'Unpublish' }));
        await s.page.getByText('Telling the Time is unpublished.').first().waitFor();
        await settle(s, 1200);
      },
    },
    {
      caption: 'Wait until you see **Publish**.',
      run: async (s) => {
        await s.page.getByRole('button', { name: 'Publish', exact: true }).first().waitFor();
        await s.pause(1200);
      },
    },
    {
      caption: 'Click **Move to Trash**.',
      note: 'Only Admins and Super admins can do this. The video waits in Trash for 30 days.',
      run: async (s) => {
        await s.page.getByRole('button', { name: 'Publish', exact: true }).first().waitFor();
        await s.pause(1500);
        const b = s.page.getByRole('button', { name: 'Move to Trash', exact: true }).first();
        await s.reveal(b, 0.4);
        await s.click(b);
        await s.page.getByRole('dialog').waitFor();
        await settle(s, 500);
      },
    },
    {
      caption: 'Click **Move to Trash** to confirm.',
      run: async (s) => {
        await s.click(s.page.getByRole('dialog').getByRole('button', { name: 'Move to Trash' }));
        await s.page.getByRole('heading', { name: 'Videos' }).first().waitFor();
        await settle(s, 1000);
      },
    },
    {
      caption: 'Choose **Trash** in the side menu.',
      run: async (s) => {
        await goToScreen(s, 'Trash');
        await s.page.getByRole('heading', { name: 'Trash' }).first().waitFor();
      },
      shot: {
        name: 'trash',
        alt: 'The Trash list with the Restore button of Welcome Video (old cut) marked 1',
        marks: [{ target: (s) => s.page.getByRole('button', { name: 'Restore Welcome Video (old cut)' }), label: 'Restore' }],
      },
    },
    {
      caption: 'Click **Restore Welcome Video (old cut)**.',
      note: 'A restored video comes back as a draft. Publish it again when you are ready.',
      run: async (s) => {
        await s.click(s.page.getByRole('button', { name: 'Restore Welcome Video (old cut)' }));
        await s.page.getByText('Welcome Video (old cut) was restored.').first().waitFor();
        await settle(s, 1200);
      },
    },
    {
      caption: 'Check that **Delete forever** is there.',
      note: 'Delete forever removes a video for good. Use it only when you are sure.',
      run: async (s) => {
        await pointAt(s, s.page.getByRole('button', { name: /^Delete forever/ }).first());
      },
    },
  ],
};

export default episode;
