import type { Episode } from '../episode';
import { navStep, rowLink } from '../c1-common';
import { clickByName, waitForToast } from '../helpers';

/** D09 Schedule a video for later: the same Publish box, with Schedule and a date in Lagos time. */
const episode: Episode = {
  id: 'D09',
  title: 'Schedule a video for later',
  role: 'editor',
  screens: ['/admin/videos/[id]'],
  actions: ['video.publish'],
  covers: { statuses: ['publish:scheduled'] },
  dependsOn: ['apps/web/src/components/admin/PublishDialog.tsx', 'apps/web/src/components/admin/VideoEditor.tsx'],
  next: 'D10 Find videos and change many at once',
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
    {
      caption: 'Click **Publish**.',
      holdMs: 1800,
      run: async (s) => {
        await clickByName(s, 'button', 'Publish', { exact: true });
        await s.page.getByRole('heading', { name: 'Publish this video' }).waitFor();
      },
    },
    {
      caption: 'Click **Schedule**.',
      holdMs: 1800,
      run: async (s) => {
        await s.click(s.page.getByRole('radio', { name: /^Schedule/ }));
        await s.page.getByRole('textbox', { name: 'Date', exact: true }).waitFor();
      },
    },
    {
      caption: 'Type "12/03/2026" in the **Date** box.',
      note: 'Times are Lagos time, all year. The day comes first. A computer set to American style shows the month first. The practice site clock says it is 10 Mar 2026.',
      holdMs: 2000,
      run: async (s) => {
        await s.type(s.page.getByRole('textbox', { name: 'Date', exact: true }), '12/03/2026');
      },
      shot: {
        name: 'date',
        alt: 'The Date and Time boxes of the Schedule choice, with Date marked 1',
        marks: [{ target: (s) => s.page.getByRole('textbox', { name: 'Date', exact: true }), label: 'Date' }],
      },
    },
    {
      caption: 'Click **Schedule for 12 Mar, 9:00**.',
      note: 'The button names the day and time you chose. The time box starts at 9:00 AM.',
      holdMs: 2000,
      run: async (s) => {
        await s.click(s.page.getByRole('button', { name: /^Schedule for / }));
      },
    },
    {
      caption: 'Wait until you see **is scheduled**.',
      holdMs: 15000,
      run: async (s) => {
        await waitForToast(s, 'is scheduled');
      },
      shot: {
        name: 'scheduled',
        alt: 'The message that the video is scheduled, marked 1',
        marks: [{ target: (s) => s.page.getByText('is scheduled').first(), label: 'Scheduled' }],
      },
    },
  ],
};

export default episode;
