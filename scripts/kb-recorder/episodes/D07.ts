import type { Episode } from '../episode';
import { lookStep, navStep, rowLink } from '../c1-common';
import { clickByName, waitForToast } from '../helpers';

/** D07 Review and approve captions: open the oldest waiting video, play it, approve when it reads right. */
const episode: Episode = {
  id: 'D07',
  title: 'Review and approve captions',
  role: 'editor',
  screens: ['/admin/captions', '/admin/captions/[videoId]'],
  actions: ['caption.review'],
  covers: { nav: ['Captions'], statuses: ['caption:in_review', 'caption:approved'] },
  dependsOn: [
    'apps/web/src/components/admin/CaptionReview.tsx',
    'apps/web/src/components/admin/CaptionTable.tsx',
    'apps/web/src/components/admin/CaptionList.tsx',
    'apps/web/src/app/admin/(shell)/captions',
  ],
  viewports: ['desktop', 'mobile'],
  next: 'D08 Publish or unpublish a video',
  steps: [
    navStep('Captions', 'Choose **Captions** in the side menu.', {
      shot: { name: 'list', alt: 'The Captions list with the oldest waiting video marked 1' },
    }),
    {
      caption: 'Click **Review captions for How Plants Make Food**.',
      note: 'A video that needs a check has a blue Review button.',
      holdMs: 1800,
      run: async (s) => {
        await s.click(rowLink(s, 'Review captions for How Plants Make Food', 'How Plants Make Food'));
        await s.page.getByRole('button', { name: 'Approve captions', exact: true }).waitFor();
      },
      shot: {
        name: 'review',
        alt: 'The caption review screen with the video and the cue list marked 1',
        marks: [{ target: (s) => s.page.getByLabel('Video preview'), label: 'Video' }],
      },
    },
    {
      caption: 'Click **Play** to watch the video with its captions.',
      holdMs: 3500,
      run: async (s) => {
        await clickByName(s, 'button', 'Play', { exact: true });
        await s.pause(1500);
      },
    },
    {
      caption: 'Click **Pause** when you want to read a cue.',
      holdMs: 1800,
      run: async (s) => {
        // On a narrow screen the preview may already have stopped, so only press Pause when it is there.
        const pause = s.page.getByRole('button', { name: 'Pause', exact: true });
        if (await pause.isVisible().catch(() => false)) await s.click(pause);
        else await s.pause(1200);
      },
    },
    lookStep(
      'Check that **Approving is allowed with warnings** shows under the video.',
      (s) => s.page.getByText('Approving is allowed with warnings').first(),
      { shot: { name: 'cues', alt: 'The warnings note under the video marked 1', label: 'Warnings' } },
    ),
    {
      caption: 'Click **Approve captions**.',
      note: 'Approve only when the words match what is said. Anyone can still edit them later.',
      holdMs: 2000,
      run: async (s) => {
        await clickByName(s, 'button', 'Approve captions', { exact: true });
      },
      shot: {
        name: 'approve',
        alt: 'The Approve captions button marked 1',
        marks: [{ target: (s) => s.page.getByRole('button', { name: /Approve/ }).first(), label: 'Approve captions' }],
      },
    },
    {
      caption: 'Wait until you see **Captions approved**.',
      holdMs: 3000,
      run: async (s) => {
        await waitForToast(s, 'Captions approved');
      },
      shot: {
        name: 'approved',
        alt: 'The message Captions approved marked 1',
        marks: [{ target: (s) => s.page.getByText('Captions approved').first(), label: 'Approved' }],
      },
    },
  ],
};

export default episode;
