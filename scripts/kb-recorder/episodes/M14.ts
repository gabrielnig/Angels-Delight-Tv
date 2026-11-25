import { submit, money, menu, choose, button, see, type } from '../money-steps';

export default money({
  id: 'M14',
  title: 'Find gifts with the filters',
  role: 'admin',
  screens: ['/admin/donations'],
  actions: ['donation.view'],
  dependsOn: ['apps/web/src/app/admin/(shell)/donations/page.tsx'],
  next: 'M15 Show a donor email and why it is recorded',
  notes: { 10: ['NOTE','Type the day, month and year with no spaces, for example 03032026 for 3 Mar 2026.'] },
  steps: [
    menu('Donations', 'Donations', { name: 'filters', alt: 'The filter bar with Status, Kind, From and To marked 1', marks: [[['label', 'Status'], 'Filters']] }),
    choose('needs review', 'Status'),
    submit('Apply', { name: 'review', alt: 'The list filtered to gifts that need review, marked 1', marks: [[['link', 'addondemo06'], 'The one gift']] }),
    see('addondemo06', 'shows in the list'),
    choose('All', 'Status'),
    choose('Monthly', 'Kind'),
    submit('Apply'),
    see('No gifts match.', 'shows because no monthly gifts exist yet', { name: 'none', alt: 'The empty list message, marked 1', marks: [[['text', 'No gifts match.'], 'Nothing found']] }),
    choose('All', 'Kind'),
    type('From', '03032026'),
    submit('Apply'),
    see('addondemo01', 'shows in the list'),
  ],
});
