import type { Episode } from '../episode';
import { goToScreen } from '../helpers';
import { pointAt, settle } from '../safety-helpers';

/** K08: find the retention settings and the Pages tab that holds the Privacy page. Text only article, no published video. */
const episode: Episode = {
  id: 'K08',
  title: 'What data we keep and for how long',
  role: 'admin',
  screens: ['/admin/site-settings'],
  actions: ['settings.site'],
  covers: {
    settings: ['analytics.raw_retention_days', 'audit.retention_months'],
  },
  dependsOn: ['apps/web/src/components/admin/site/SiteSettingsView.tsx'],
  next: 'K05 Reset a viewer\'s two step sign in and delete an account on request',
  steps: [
    {
      caption: 'Choose **Site settings** in the side menu.',
      run: async (s) => {
        await goToScreen(s, 'Site settings');
        await s.page.getByRole('heading', { name: 'Site settings' }).first().waitFor();
      },
    },
    {
      caption: 'Click **Features and limits**.',
      note: 'Admins can read this tab. Only a Super admin can change it.',
      run: async (s) => {
        await s.click(s.page.getByRole('tab', { name: 'Features and limits' }));
        await s.page.getByLabel('Raw view event retention (days)').waitFor();
        await settle(s, 600);
      },
    },
    {
      caption: 'Scroll to **Raw view event retention (days)**.',
      note: 'This is how many days detailed view records are kept. The standard is 90.',
      run: async (s) => {
        const f = s.page.getByLabel('Raw view event retention (days)');
        await s.reveal(f, 0.4);
        await pointAt(s, f);
      },
      shot: {
        name: 'retention',
        alt: 'The two retention boxes, view events in days and audit log in months, marked 1 and 2',
        marks: [
          { target: (s) => s.page.getByLabel('Raw view event retention (days)'), label: 'View records' },
          { target: (s) => s.page.getByLabel('Audit log retention (months)'), label: 'Audit log' },
        ],
      },
    },
    {
      caption: 'Scroll to **Audit log retention (months)**.',
      note: 'This is how long the audit log is kept. The standard is 24 months.',
      run: async (s) => {
        const f = s.page.getByLabel('Audit log retention (months)');
        await s.reveal(f, 0.4);
        await pointAt(s, f);
      },
    },
    {
      caption: 'Click **Pages**.',
      note: 'The Privacy page that visitors read is edited here by an Admin.',
      run: async (s) => {
        await s.reveal(s.page.getByRole('tab', { name: 'Pages' }), 0.3);
        await s.click(s.page.getByRole('tab', { name: 'Pages' }));
        await settle(s, 800);
      },
      shot: {
        name: 'pages-tab',
        alt: 'The Pages tab of Site settings, marked 1',
        marks: [{ target: (s) => s.page.getByRole('tab', { name: 'Pages' }), label: 'Pages' }],
      },
    },
  ],
};

export default episode;
