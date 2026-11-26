import type { Episode } from '../episode';
import { goToScreen, scrollTo } from '../helpers';

const episode: Episode = {
  id: 'W15',
  title: 'See how often your titles are shared',
  role: 'editor',
  screens: [],
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
      caption: 'Scroll to **Shares by channel**.',
      note: 'The list shows how many times viewers used each Share option in the period you chose.',
      holdMs: 4000,
      run: async (s) => {
        await scrollTo(s, s.page.getByRole('heading', { name: 'Shares by channel' }));
      },
      shot: {
        name: 'overview',
        alt: 'The Shares by channel card listing each option with a count, marked 1',
        marks: [{ target: (s) => s.page.getByRole('group', { name: 'Shares by channel' }), label: 'Shares by channel' }],
      },
    },
    {
      caption: 'Click **Washing Hands the Right Way** in Top titles.',
      holdMs: 4000,
      run: async (s) => {
        await scrollTo(s, s.page.getByRole('link', { name: 'Washing Hands the Right Way' }));
        await s.click(s.page.getByRole('link', { name: 'Washing Hands the Right Way' }));
        await s.page.getByRole('group', { name: 'Finished watching' }).waitFor();
      },
    },
    {
      caption: 'Scroll to **Shares by channel**.',
      note: 'On a title page the counts are for that title alone.',
      holdMs: 4000,
      run: async (s) => {
        await scrollTo(s, s.page.getByRole('heading', { name: 'Shares by channel' }));
      },
      shot: {
        name: 'one-video',
        alt: 'The Shares by channel card on the page of one video, marked 1',
        marks: [{ target: (s) => s.page.getByRole('group', { name: 'Shares by channel' }), label: 'Shares of this video' }],
      },
    },
  ],
};

export default episode;
