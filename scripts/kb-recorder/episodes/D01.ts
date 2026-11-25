import type { Episode } from '../episode';
import { lookStep, navStep } from '../c1-common';
import { highlight, scrollTo } from '../helpers';

/** D01 Check the Dashboard: tiles, Needs attention, recent uploads, storage and the 7 day chart. */
const episode: Episode = {
  id: 'D01',
  title: 'Check the Dashboard',
  role: 'editor',
  screens: ['/admin'],
  actions: ['admin.access'],
  dependsOn: ['apps/web/src/components/admin/DashboardView.tsx', 'apps/web/src/lib/data/admin/dashboard.ts'],
  viewports: ['desktop', 'mobile'],
  next: 'D02 Upload one video',
  steps: [
    lookStep(
      'Check that the **Published** tile counts the videos viewers can watch.',
      (s) => s.page.getByText('Published', { exact: true }).first(),
      { shot: { name: 'tiles', alt: 'The four video tiles with Published marked 1', label: 'Published' } },
    ),
    lookStep(
      'Check that the **Needs attention** card lists what waits for you.',
      (s) => s.page.getByRole('heading', { name: 'Needs attention' }),
      { shot: { name: 'attention', alt: 'The Needs attention card marked 1', label: 'Needs attention' } },
    ),
    {
      caption: 'Scroll to **Recent uploads**.',
      holdMs: 3400,
      run: async (s) => {
        await scrollTo(s, s.page.getByRole('heading', { name: 'Recent uploads' }), 0.4);
        await highlight(s, s.page.getByRole('heading', { name: 'Recent uploads' }), 900);
      },
      shot: {
        name: 'recent',
        alt: 'The Recent uploads card marked 1',
        marks: [{ target: (s) => s.page.getByRole('heading', { name: 'Recent uploads' }), label: 'Recent uploads' }],
      },
    },
    {
      caption: 'Scroll to **Storage used**.',
      note: 'Admins see the numbers here. Editors see a note that says to ask an Admin.',
      holdMs: 3400,
      run: async (s) => {
        await scrollTo(s, s.page.getByRole('heading', { name: 'Storage used' }), 0.4);
        await highlight(s, s.page.getByRole('heading', { name: 'Storage used' }), 900);
      },
    },
    {
      caption: 'Scroll to **Views, last 7 days**.',
      holdMs: 3400,
      run: async (s) => {
        await scrollTo(s, s.page.getByText('Views, last 7 days').first(), 0.4);
        await highlight(s, s.page.getByText('Views, last 7 days').first(), 900);
      },
      shot: {
        name: 'views',
        alt: 'The chart of views in the last 7 days marked 1',
        marks: [{ target: (s) => s.page.getByText('Views, last 7 days').first(), label: 'Views' }],
      },
    },
    {
      caption: 'Click **Open in Encoding** to go straight to a video that needs you.',
      holdMs: 5000,
      run: async (s) => {
        const link = s.page.getByRole('link', { name: 'Open in Encoding', exact: true }).first();
        await scrollTo(s, link, 0.3);
        await s.click(link);
        await s.page.getByRole('heading', { name: 'Encoding' }).first().waitFor();
      },
    },
    navStep('Dashboard', 'Choose **Dashboard** in the side menu to come back.', {
      shot: { name: 'back', alt: 'The Dashboard again with its heading marked 1' },
    }),
  ],
};

export default episode;
