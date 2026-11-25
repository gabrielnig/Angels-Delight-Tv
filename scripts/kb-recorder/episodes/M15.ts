import { money, menu, link, button, see } from '../money-steps';

export default money({
  id: 'M15',
  title: 'Show a donor email and why it is recorded',
  role: 'admin',
  screens: ['/admin/donations/[id]'],
  actions: ['donation.view'],
  dependsOn: ['apps/web/src/components/admin/DonationReviewPanel.tsx'],
  next: 'M16 Bank transfer instructions',
  notes: { 3: ['CAREFUL','This view is written to the audit log. Show an email only when you need it.'] },
  steps: [
    menu('Donations', 'Donations'),
    link('addondemo01', { name: 'masked', alt: 'A gift with the email masked and Show full email marked 1', marks: [[['button', 'Show full email'], 'Show full email']] }),
    button('Show full email', undefined, '', 1200),
    see('This view was recorded in the audit log.', 'shows under the email', { name: 'shown', alt: 'The full email with the audit note marked 1', marks: [[['text', 'This view was recorded in the audit log.'], 'Audit note']] }),
  ],
});
