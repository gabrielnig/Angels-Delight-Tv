import type { Episode } from '../episode';
import { goToScreen } from '../helpers';

const episode: Episode = {
  id: 'W12',
  title: 'Make and download a report',
  role: 'editor',
  screens: ['/admin/exports', '/admin/exports/new'],
  actions: ['analytics.view'],
  covers: { nav: ['Exports'] },
  dependsOn: [
    'apps/web/src/app/admin/(shell)/exports',
    'apps/web/src/app/admin/(shell)/analytics/export',
    'apps/web/src/components/admin/ExportsView.tsx',
    'apps/web/src/lib/data/admin/exports-rules.ts',
  ],
  next: 'M06 Read a sponsor report and print it',
  steps: [
    {
      caption: 'Choose **Analytics** in the side menu.',
      run: async (s) => {
        await goToScreen(s, 'Analytics');
        await s.page.getByRole('heading', { name: 'Analytics' }).first().waitFor();
      },
    },
    {
      caption: 'Click **Last 90 days**.',
      note: 'The report holds the dates you see on screen.',
      run: async (s) => {
        await s.click(s.page.getByRole('link', { name: 'Last 90 days', exact: true }));
        await s.page.waitForLoadState('networkidle').catch(() => {});
      },
    },
    {
      caption: 'Click **Export CSV**.',
      note: 'A small report downloads at once. A very large one is built in the background and emailed to you as a link.',
      run: async (s) => {
        const link = s.page.getByRole('link', { name: 'Export CSV' });
        await s.point(link);
        await s.click(link);
      },
      shot: {
        name: 'export-csv',
        alt: 'The Analytics page with the Export CSV button marked 1',
        marks: [{ target: (s) => s.page.getByRole('link', { name: 'Export CSV' }), label: 'Export CSV' }],
      },
    },
    {
      caption: 'Choose **Exports** in the side menu.',
      note: 'Exports lists the large reports you asked for, newest first.',
      run: async (s) => {
        await goToScreen(s, 'Exports');
        await s.page.getByRole('heading', { name: 'Exports' }).first().waitFor();
      },
      shot: {
        name: 'exports-list',
        alt: 'The Exports page with its message marked 1',
        marks: [{ target: (s) => s.page.getByText('No exports yet.'), label: 'Your large reports appear here' }],
      },
    },
    {
      caption: 'Check that **No exports yet.** is on the page.',
      note: 'Once a large export is Ready, a Download link appears on its row and works for 3 days.',
      run: async (s) => {
        await s.point(s.page.getByText('No exports yet.'));
      },
    },
  ],
};

export default episode;
