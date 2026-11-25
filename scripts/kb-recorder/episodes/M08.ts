import { money, menu, see, link } from '../money-steps';

export default money({
  id: 'M08',
  title: 'See donations and download the list',
  role: 'admin',
  screens: ['/admin/donations', '/admin/donations/[id]'],
  actions: ['donation.view', 'donation.export'],
  dependsOn: ['apps/web/src/components/admin/DonationsView.tsx', 'apps/web/src/app/admin/(shell)/donations'],
  next: 'M09 Settle a gift that needs review',
  steps: [
    menu('Donations', 'Donations', { name: 'list', alt: 'The Donations list with the table marked 1 and Export CSV marked 2', marks: [[['text', 'Donations, newest first'], 'Gift table'], [['link', 'Export CSV'], 'Export CSV']] }),
    see('Test gifts are not counted.', 'shows under the totals'),
    see('Anonymous', 'shows for donors who asked to stay private'),
    link('Export CSV', undefined, ' to download the list'),
    link('addondemo01', { name: 'gift', alt: 'One gift with its status and receipt line marked 1', marks: [[['text', 'Receipt queued'], 'Receipt']] }),
    see('Receipt queued', 'shows under the reference'),
  ],
});
