import type { Episode } from '../episode';
import { lookStep, navStep, rowLink } from '../c1-common';
import { clickByName, waitForToast } from '../helpers';

/** D08 Publish or unpublish a video: a ready video goes live, then is taken down again. */
const episode: Episode = {
  id: 'D08',
  title: 'Publish or unpublish a video',
  role: 'editor',
  screens: ['/admin/videos', '/admin/videos/[id]'],
  actions: ['video.publish'],
  covers: { statuses: ['publish:draft', 'publish:published'] },
  dependsOn: [
    'apps/web/src/components/admin/PublishDialog.tsx',
    'apps/web/src/components/admin/VideoEditor.tsx',
    'apps/web/src/components/admin/ChecklistCard.tsx',
  ],
  viewports: ['desktop', 'mobile'],
  next: 'D09 Schedule a video for later',
  steps: [
    navStep('Videos', 'Choose **Videos** in the side menu.'),
    {
      caption: 'Click **Edit Staying Safe Online**.',
      holdMs: 1800,
      run: async (s) => {
        await s.click(rowLink(s, 'Edit Staying Safe Online', 'Staying Safe Online'));
        await s.page.getByText('Before you publish').first().waitFor();
      },
    },
    lookStep(
      'Check that **Before you publish** shows every step done.',
      (s) => s.page.getByText('Before you publish').first(),
      { shot: { name: 'checklist', alt: 'The Before you publish checklist marked 1', label: 'Checklist' } },
    ),
    {
      caption: 'Click **Publish**.',
      holdMs: 1800,
      run: async (s) => {
        await clickByName(s, 'button', 'Publish', { exact: true });
        await s.page.getByRole('heading', { name: 'Publish this video' }).waitFor();
      },
      shot: {
        name: 'dialog',
        alt: 'The Publish this video box with Publish now marked 1',
        marks: [{ target: (s) => s.page.getByRole('button', { name: 'Publish now', exact: true }), label: 'Publish now' }],
      },
    },
    {
      caption: 'Click **Publish now**.',
      holdMs: 1800,
      run: async (s) => {
        await clickByName(s, 'button', 'Publish now', { exact: true });
      },
    },
    {
      caption: 'Wait until you see **is live**.',
      holdMs: 3000,
      run: async (s) => {
        await waitForToast(s, 'is live');
      },
      shot: {
        name: 'live',
        alt: 'The message that the video is live marked 1',
        marks: [{ target: (s) => s.page.getByText('is live').first(), label: 'Live' }],
      },
    },
    {
      caption: 'Click **Unpublish** to hide the video again.',
      holdMs: 1800,
      run: async (s) => {
        await clickByName(s, 'button', 'Unpublish', { exact: true, first: true });
        await s.page.getByRole('heading', { name: /^Unpublish / }).waitFor();
      },
    },
    {
      caption: 'Click **Unpublish** to confirm.',
      note: 'Viewers can no longer find or watch the video. You can publish it again any time.',
      holdMs: 1800,
      run: async (s) => {
        const confirm = s.page.getByRole('dialog').getByRole('button', { name: 'Unpublish', exact: true });
        await s.click(confirm);
      },
    },
    {
      caption: 'Wait until you see **is unpublished**.',
      holdMs: 3000,
      run: async (s) => {
        await waitForToast(s, 'is unpublished');
      },
      shot: {
        name: 'unpublished',
        alt: 'The message that the video is unpublished marked 1',
        marks: [{ target: (s) => s.page.getByText('is unpublished').first(), label: 'Unpublished' }],
      },
    },
  ],
};

export default episode;
