import { money, menu, link, type, button, see } from '../money-steps';

export default money({
  id: 'M06',
  title: 'Read a sponsor report and print it',
  role: 'admin',
  screens: ['/admin/sponsors/[id]/report', '/admin/sponsors/[id]/report/print'],
  actions: ['sponsor.report.export'],
  dependsOn: ['apps/web/src/components/admin/SponsorReportView.tsx', 'apps/web/src/app/admin/(shell)/sponsors/[id]/report'],
  next: 'M07 Set up donations: what you set and what the developer sets',
  notes: { 4: ['NOTE','Type the day, month and year with no spaces, for example 03032026 for 3 Mar 2026. Leave To empty for up to today.'], 8: ['NOTE','Only Admins see Download CSV. The file has no personal details.'] },
  steps: [
    menu('Sponsors', 'Sponsors'),
    link('Demo Sponsor Ltd (test)'),
    link('Report', { name: 'report', alt: 'The report with the date boxes marked 1', marks: [[['label', 'From'], 'Dates']] }),
    type('From', '03032026'),
    button('Show', { name: 'numbers', alt: 'The report numbers marked 1', marks: [[['text', 'Impressions'], 'Totals']] }),
    see('Impressions', 'shows in the number tiles'),
    see('Reach is a daily figure', 'shows under the tiles', { name: 'reach', alt: 'The note about daily reach, marked 1', marks: [[['text', 'Reach is a daily figure'], 'Reach note']] }),
    link('Download CSV'),
    link('Print', { name: 'print', alt: 'The printable report, marked 1', marks: [[['text', 'sponsor report'], 'Printable page']] }),
  ],
});
