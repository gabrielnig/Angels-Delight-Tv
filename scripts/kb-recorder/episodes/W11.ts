import type { Episode } from '../episode';
import { goToScreen, highlight, scrollTo } from '../helpers';

const episode: Episode = {
  id: 'W11',
  title: 'See how one video is doing',
  role: 'editor',
  screens: ['/admin/analytics/[id]'],
  actions: ['analytics.view'],
  dependsOn: [
    'apps/web/src/app/admin/(shell)/analytics',
    'apps/web/src/components/admin/AnalyticsView.tsx',
    'apps/web/src/lib/data/admin/analytics-rules.ts',
  ],
  next: 'W12 Make and download a report',
  steps: [
    {
      caption: 'Choose **Analytics** in the side menu.',
      holdMs: 4000,
      run: async (s) => {
        await goToScreen(s, 'Analytics');
        await s.page.getByRole('heading', { name: 'Top titles' }).waitFor();
      },
    },
    {
      caption: 'Click **Washing Hands the Right Way** in Top titles.',
      note: 'Every title in the table opens its own page.',
      holdMs: 4000,
      run: async (s) => {
        await scrollTo(s, s.page.getByRole('link', { name: 'Washing Hands the Right Way' }));
        await s.click(s.page.getByRole('link', { name: 'Washing Hands the Right Way' }));
        await s.page.getByRole('group', { name: 'Finished watching' }).waitFor();
      },
      shot: {
        name: 'one-video',
        alt: 'The analytics page of one video with its three tiles marked 1',
        marks: [
          { target: (s) => s.page.getByRole('group', { name: 'Watch time' }), label: 'The three tiles' },
        ],
      },
    },
    {
      caption: 'Check that the **Finished watching** tile shows a percent.',
      note: 'A low number can mean the video is too long or the start is slow.',
      holdMs: 4000,
      run: async (s) => {
        await highlight(s, s.page.getByRole('group', { name: 'Finished watching' }));
      },
    },
    {
      caption: 'Scroll to **Views each day**.',
      note: 'Look for a spike after you added the video to Home or a series.',
      holdMs: 4000,
      run: async (s) => {
        await scrollTo(s, s.page.getByText('Views each day').first());
      },
      shot: {
        name: 'daily',
        alt: 'The Views each day chart of one video',
        marks: [{ target: (s) => s.page.getByText('Views each day').first(), label: 'Daily views' }],
      },
    },
    {
      caption: 'Scroll to **Where viewers stop**.',
      note: 'The line falls where people leave. A steep drop near the start suggests a slow intro.',
      holdMs: 4000,
      run: async (s) => {
        await scrollTo(s, s.page.getByText('Where viewers stop').first());
      },
      shot: {
        name: 'retention',
        alt: 'The Where viewers stop chart, with the share of viewers still watching at each point',
        marks: [{ target: (s) => s.page.getByText('Where viewers stop').first(), label: 'Where viewers stop' }],
      },
    },
    {
      caption: 'Click **Last 90 days**.',
      note: 'A longer range smooths out a quiet week.',
      holdMs: 4000,
      run: async (s) => {
        await s.page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
        await s.pause(600);
        await s.click(s.page.getByRole('link', { name: 'Last 90 days', exact: true }));
        await s.page.waitForLoadState('networkidle').catch(() => {});
      },
    },
  ],
};

export default episode;
