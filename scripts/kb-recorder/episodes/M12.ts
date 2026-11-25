import { money, menu, see, link } from '../money-steps';

export default money({
  id: 'M12',
  title: 'The Donate page and its wording',
  role: 'admin',
  screens: ['/admin/donations'],
  actions: ['donation.view'],
  covers: { settings: ['donate.intro_title', 'donate.intro_body', 'donate.thank_you_title', 'donate.thank_you_body'] },
  dependsOn: ['apps/web/src/components/donate/DonateForm.tsx', 'packages/theme/src/settings-monetization.ts'],
  next: 'M13 Receipts: what donors get',
  steps: [
    menu('Donations', 'Donations'),
    see('Gifts received through Paystack', 'shows under the title', { name: 'lead', alt: 'The Donations screen title line, marked 1', marks: [[['text', 'Gifts received through Paystack'], 'Gifts from the Donate page']] }),
    link('addondemo01', { name: 'gift', alt: 'A gift made on the Donate page, marked 1', marks: [[['text', 'addondemo01'], 'Reference']] }),
    see('addondemo01', 'shows as the gift reference'),
  ],
});
