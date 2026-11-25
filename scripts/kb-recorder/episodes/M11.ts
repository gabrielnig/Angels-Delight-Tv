import { submit, money, menu, see, choose, button, link } from '../money-steps';

export default money({
  id: 'M11',
  title: 'Test mode and live mode',
  role: 'admin',
  screens: ['/admin/donations'],
  actions: ['donation.view'],
  dependsOn: ['apps/web/src/components/admin/DonationsView.tsx'],
  next: 'M12 The Donate page and its wording',
  steps: [
    menu('Donations', 'Donations'),
    see('Test gifts are not counted.', 'shows under the totals', { name: 'note', alt: 'The totals note, marked 1', marks: [[['text', 'Test gifts are not counted.'], 'Test gifts']] }),
    choose('succeeded', 'Status'),
    submit('Apply', { name: 'filtered', alt: 'The list with a Test badge on every row, marked 1', marks: [[['link', 'addondemo01'], 'A test gift']] }),
    link('addondemo01'),
    see('Test', 'shows next to the status', { name: 'badge', alt: 'The Test badge on one gift, marked 1', marks: [[['text', 'Succeeded'], 'Badges']] }),
  ],
});
