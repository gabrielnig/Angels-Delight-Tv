import { money, menu, see } from '../money-steps';

export default money({
  id: 'M17',
  title: 'The transparency page',
  role: 'admin',
  screens: ['/admin/donations'],
  actions: ['donation.view'],
  covers: { settings: ['donate.transparency.enabled', 'donate.transparency.title', 'donate.transparency.intro', 'donate.transparency.items', 'donate.transparency.updated_at'] },
  dependsOn: ['apps/web/src/components/donate/TransparencyList.tsx', 'packages/theme/src/settings-monetization.ts'],
  next: 'M18 Sponsor pictures: sizes and descriptions',
  steps: [
    menu('Donations', 'Donations'),
    see('Emails are masked', 'shows under the title', { name: 'privacy', alt: 'The privacy line under the Donations title, marked 1', marks: [[['text', 'Emails are masked'], 'Privacy line']] }),
    see('Anonymous', 'shows instead of a name for private donors', { name: 'anon', alt: 'The Anonymous donor row, marked 1', marks: [[['text', 'Anonymous'], 'Hidden name']] }),
  ],
});
