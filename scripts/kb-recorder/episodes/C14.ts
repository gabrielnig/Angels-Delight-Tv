import type { Episode } from '../episode';
import { clickByName, goToScreen, highlight, padSteps } from '../c3-helpers';

const episode: Episode = {
  id: 'C14',
  title: 'System: jobs, storage and player quality',
  role: 'super_admin',
  screens: ['/admin/system'],
  actions: ['system.view', 'system.jobs'],
  covers: { nav: ['System'] },
  dependsOn: ['apps/web/src/components/admin/SystemView.tsx', 'apps/web/src/app/admin/(shell)/system'],
  next: 'T10 Storage is nearly full',
  steps: padSteps([
    {
      caption: 'Click **System** in the side menu.',
      run: async (s) => { await goToScreen(s, 'System'); await s.page.getByRole('heading', { name: 'System' }).first().waitFor(); },
      shot: {
        name: 'jobs',
        alt: 'The System screen with the Jobs tab marked 1',
        marks: [{ target: (s) => s.page.getByRole('tab', { name: /^Jobs/ }), label: 'Jobs' }],
      },
    },
    {
      caption: 'Check the job **Email: Invite to sade@example.test**.',
      note: 'The Jobs tab lists work that failed, such as encodes, captions and emails. A failed email job means the mail service refused the message. Retry it, or Discard it. Only Super admins can do either.',
      run: async (s) => highlight(s, s.page.getByText('Email: Invite to sade@example.test').first(), 2600),
      shot: {
        name: 'email-job',
        alt: 'The failed email job marked 1',
        marks: [{ target: (s) => s.page.getByText('Email: Invite to sade@example.test').first(), label: 'Failed email' }],
      },
    },
    {
      caption: 'Click **Storage** at the top.',
      run: async (s) => { await clickByName(s, 'tab', 'Storage', { exact: true }); await s.page.getByText('Storage used').first().waitFor(); },
    },
    {
      caption: 'Check **Storage used** and the list below it.',
      note: 'The list shows what takes the space: videos, posters, captions and other files. The estimate says when you will reach your budget.',
      run: async (s) => highlight(s, s.page.getByText('Storage used').first(), 2600),
      shot: {
        name: 'storage',
        alt: 'The Storage tab with the used space marked 1',
        marks: [{ target: (s) => s.page.getByText('Storage used').first(), label: 'Storage used' }],
      },
    },
    {
      caption: 'Click **Player quality** at the top.',
      run: async (s) => { await clickByName(s, 'tab', 'Player quality', { exact: true }); await s.page.getByText('Typical start time').first().waitFor(); },
    },
    {
      caption: 'Check **Typical start time**.',
      note: 'This is how long viewers wait for a video to start. Slow start, stalling and playback errors are listed below it. Send these numbers to your developer if they look bad.',
      run: async (s) => highlight(s, s.page.getByText('Typical start time').first(), 2600),
      shot: {
        name: 'player',
        alt: 'The Player quality tab with the start time marked 1',
        marks: [{ target: (s) => s.page.getByText('Typical start time').first(), label: 'Start time' }],
      },
    },
  ]),
};
export default episode;
