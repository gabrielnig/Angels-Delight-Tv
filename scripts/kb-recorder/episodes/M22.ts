import { submit, money, menu, choose, button, see } from '../money-steps';

export default money({
  id: 'M22',
  title: 'Monthly giving: not available yet',
  role: 'admin',
  screens: ['/admin/donations'],
  actions: ['donation.view'],
  covers: { settings: ['donate.monthly.enabled'] },
  dependsOn: ['apps/web/src/app/admin/(shell)/donations/page.tsx'],
  next: 'M23 Taxes and legal notes',
  steps: [
    menu('Donations', 'Donations'),
    choose('Monthly', 'Kind', { name: 'kind', alt: 'The Kind list set to Monthly, marked 1', marks: [[['label', 'Kind'], 'Kind']] }),
    submit('Apply'),
    see('No gifts match.', 'shows because nobody can give monthly yet', { name: 'none', alt: 'The empty list, marked 1', marks: [[['text', 'No gifts match.'], 'No monthly gifts']] }),
  ],
});
