import { money, menu, see } from '../money-steps';

export default money({
  id: 'M07',
  title: 'Set up donations: what you set and what the developer sets',
  role: 'admin',
  screens: ['/admin/donations'],
  actions: ['donation.view'],
  covers: { nav: ['Donations'], settings: ['donate.enabled', 'donate.org_name', 'donate.org_registration', 'donate.presets_minor.ngn', 'donate.presets_minor.usd', 'donate.min_minor.ngn', 'donate.max_minor.ngn', 'donate.currencies', 'donate.usd.enabled', 'donate.cover_fees_option'] },
  dependsOn: ['apps/web/src/app/admin/(shell)/donations/page.tsx', 'packages/theme/src/settings-monetization.ts'],
  next: 'M08 See donations and download the list',
  steps: [
    menu('Donations', 'Donations', { name: 'donations', alt: 'The Donations screen with the title line marked 1', marks: [[['text', 'Gifts received through Paystack'], 'Where gifts appear']] }),
    see('Gifts received through Paystack', 'shows under the title'),
    see('No succeeded live gifts in this view.', 'appears', { name: 'totals', alt: 'The totals box, marked 1', marks: [[['text', 'No succeeded live gifts in this view.'], 'Totals']] }),
    see('Test gifts are not counted.', 'shows under the totals'),
  ],
});
