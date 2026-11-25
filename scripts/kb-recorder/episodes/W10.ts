import type { Episode } from '../episode';
import { goToScreen, highlight, scrollTo } from '../helpers';

const episode: Episode = {
  id: 'W10',
  title: 'Read Analytics',
  role: 'editor',
  screens: ['/admin/analytics'],
  actions: ['analytics.view'],
  covers: { nav: ['Analytics'] },
  dependsOn: [
    'apps/web/src/app/admin/(shell)/analytics',
    'apps/web/src/components/admin/AnalyticsView.tsx',
    'apps/web/src/components/admin/TopTitlesTable.tsx',
    'apps/web/src/lib/data/admin/analytics-rules.ts',
  ],
  viewports: ['desktop', 'mobile'],
  next: 'W11 See how one video is doing',
  steps: [
    {
      caption: 'Choose **Analytics** in the side menu.',
      note: 'Editors, Admins and Super admins can open this page.',
      run: async (s) => {
        await goToScreen(s, 'Analytics');
        await s.page.getByRole('heading', { name: 'Analytics' }).first().waitFor();
      },
      shot: {
        name: 'analytics',
        alt: 'The Analytics page with the date range buttons marked 1',
        marks: [
          { target: (s) => s.page.getByRole('group', { name: 'Quick ranges' }), label: 'Date ranges' },
        ],
      },
    },
    {
      caption: 'Click **Last 28 days**.',
      note: 'Days follow Lagos time. Use the **From** and **To** boxes with **Apply dates** for your own dates.',
      run: async (s) => {
        await s.click(s.page.getByRole('link', { name: 'Last 28 days', exact: true }));
        await s.page.waitForLoadState('networkidle').catch(() => {});
      },
    },
    {
      caption: 'Check that the **Views** tile shows a number.',
      note: 'Views counts each time someone starts a video.',
      run: async (s) => {
        await highlight(s, s.page.getByRole('group', { name: 'Views', exact: true }).first());
      },
      shot: {
        name: 'tiles',
        alt: 'The four tiles, with the Views tile marked 1 and its change from the period before marked 2',
        marks: [
          { target: (s) => s.page.getByRole('group', { name: 'Views', exact: true }).first(), label: 'Views' },
          {
            target: (s) => s.page.getByRole('group', { name: 'Views', exact: true }).first().locator('.adm-badge, [class*=badge]').first(),
            label: 'Change from the period before',
          },
        ],
      },
    },
    {
      caption: 'Check that the **Finished watching** tile shows a percent.',
      note: 'It is the share of views that reached the end of a video.',
      run: async (s) => {
        await highlight(s, s.page.getByRole('group', { name: 'Finished watching' }).first());
      },
    },
    {
      caption: 'Scroll to **Views each day**.',
      note: 'The line shows the busiest and quietest days.',
      run: async (s) => {
        await scrollTo(s, s.page.getByText('Views each day').first());
      },
      shot: {
        name: 'daily-chart',
        alt: 'The Views each day chart',
        marks: [{ target: (s) => s.page.getByText('Views each day').first(), label: 'Daily views' }],
      },
    },
    {
      caption: 'Scroll to **Top titles**.',
      note: 'The most watched videos in this range, with their ratings.',
      run: async (s) => {
        await scrollTo(s, s.page.getByRole('heading', { name: 'Top titles' }));
      },
      shot: {
        name: 'top-titles',
        alt: 'The Top titles table with the Sort by Likes button marked 1',
        marks: [{ target: (s) => s.page.getByRole('button', { name: 'Sort by Likes' }), label: 'Sort by Likes' }],
      },
    },
    {
      caption: 'Click **Sort by Likes**.',
      note: 'Click it again to turn the order round. A title with no ratings goes last, and one with fewer than 10 ratings shows Under 10 ratings instead of a share.',
      run: async (s) => {
        await s.click(s.page.getByRole('button', { name: 'Sort by Likes' }));
      },
    },
    {
      caption: 'Scroll to **Devices**.',
      note: 'Devices, Connection and Countries show where viewers come from. Small groups are combined as Other.',
      run: async (s) => {
        await scrollTo(s, s.page.getByText('Devices', { exact: true }).first());
      },
      shot: {
        name: 'splits',
        alt: 'The Devices, Connection and Countries cards',
        marks: [{ target: (s) => s.page.getByText('Devices', { exact: true }).first(), label: 'Devices' }],
      },
    },
  ],
};

export default episode;
