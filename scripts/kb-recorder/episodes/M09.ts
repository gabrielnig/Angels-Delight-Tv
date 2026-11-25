import { money, menu, link, see, type, button } from '../money-steps';

export default money({
  id: 'M09',
  title: 'Settle a gift that needs review',
  role: 'admin',
  screens: ['/admin/donations/[id]'],
  actions: ['donation.resolve'],
  dependsOn: ['apps/web/src/components/admin/DonationReviewPanel.tsx'],
  next: 'M10 Check Paystack with a test gift',
  notes: { 5: ['CAREFUL','Accept only if Paystack shows the money arrived. Write what you checked. Rejecting works the same way with Reject the gift.'] },
  steps: [
    menu('Donations', 'Donations'),
    link('addondemo06', { name: 'review', alt: 'A gift that needs review, with the amounts line marked 1', marks: [[['text', 'Expected'], 'Expected and paid']] }),
    see('Needs review', 'shows beside the reference'),
    see('Expected ₦15,000, paid ₦10,000.', 'shows under the reference'),
    type('Note', 'Checked Paystack in test mode. The amounts match.', { name: 'note', alt: 'The note box with the two buttons marked 1', marks: [[['label', 'Note'], 'Required note']] }),
    button('Accept the gift', undefined, '', 1500),
    see('Gift accepted', 'shows at the bottom of the screen'),
  ],
});
