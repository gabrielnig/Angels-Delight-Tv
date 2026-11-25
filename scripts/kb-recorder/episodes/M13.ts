import { money, menu, link, see } from '../money-steps';

export default money({
  id: 'M13',
  title: 'Receipts: what donors get',
  role: 'admin',
  screens: ['/admin/donations/[id]'],
  actions: ['donation.view'],
  covers: { settings: ['donate.receipts.reply_to'] },
  dependsOn: ['apps/web/src/app/admin/(shell)/donations/[id]/page.tsx', 'packages/payments/src/receipt.ts'],
  next: 'M14 Find gifts with the filters',
  steps: [
    menu('Donations', 'Donations'),
    link('addondemo01'),
    see('Receipt queued', 'shows under the reference', { name: 'queued', alt: 'A succeeded gift with the receipt line marked 1', marks: [[['text', 'Receipt queued'], 'Receipt sent']] }),
    link('Donations', undefined, ' in the top path'),
    link('addondemo04'),
    see('Receipt not queued', 'shows because the gift is still pending', { name: 'pending', alt: 'A pending gift with the receipt line marked 1', marks: [[['text', 'Receipt not queued'], 'No receipt yet']] }),
  ],
});
