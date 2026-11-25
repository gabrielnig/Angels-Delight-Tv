import { money, menu, see, link } from '../money-steps';

export default money({
  id: 'M23',
  title: 'Taxes and legal notes',
  role: 'admin',
  screens: ['/admin/donations'],
  actions: ['donation.export'],
  covers: { settings: ['donate.retention.event_days'] },
  dependsOn: ['apps/web/src/components/admin/DonationsView.tsx', 'packages/payments/src/admin/service.ts'],
  next: 'M24 Money questions answered',
  steps: [
    menu('Donations', 'Donations'),
    see('Currencies are never added together.', 'shows under the totals', { name: 'currencies', alt: 'The totals note about currencies, marked 1', marks: [[['text', 'Currencies are never added together.'], 'One total per currency']] }),
    link('Export CSV', { name: 'export', alt: 'The Export CSV button, marked 1', marks: [[['link', 'Export CSV'], 'Records for your accountant']] }, ' to keep a record'),
  ],
});
