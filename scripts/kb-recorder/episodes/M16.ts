import { money, menu, see } from '../money-steps';

export default money({
  id: 'M16',
  title: 'Bank transfer instructions',
  role: 'admin',
  screens: ['/admin/donations'],
  actions: ['donation.view'],
  covers: { settings: ['donate.bank_transfer.enabled', 'donate.bank_transfer.instructions'] },
  dependsOn: ['apps/web/src/components/donate/BankTransfer.tsx', 'packages/theme/src/settings-monetization.ts'],
  next: 'M17 The transparency page',
  steps: [
    menu('Donations', 'Donations'),
    see('Gifts received through Paystack', 'shows under the title', { name: 'lead', alt: 'The Donations title line, marked 1', marks: [[['text', 'Gifts received through Paystack'], 'Paystack gifts only']] }),
    see('Donations, newest first', 'is the list of Paystack gifts', { name: 'table', alt: 'The gifts table, marked 1', marks: [[['text', 'Donations, newest first'], 'Paystack gifts only']] }),
  ],
});
