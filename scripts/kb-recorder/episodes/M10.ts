import { money, menu, link, see } from '../money-steps';

export default money({
  id: 'M10',
  title: 'Check Paystack with a test gift',
  role: 'admin',
  screens: ['/admin/donations/[id]'],
  actions: ['donation.view'],
  dependsOn: ['apps/web/src/app/admin/(shell)/donations/[id]/page.tsx'],
  next: 'M11 Test mode and live mode',
  steps: [
    menu('Donations', 'Donations'),
    link('addondemo02', { name: 'test-gift', alt: 'A test gift with the Succeeded and Test badges marked 1', marks: [[['text', 'Succeeded'], 'Status']] }),
    see('Succeeded', 'shows beside the amount'),
    see('Test', 'shows beside it as a second badge'),
    see('Receipt queued', 'shows under the reference'),
  ],
});
