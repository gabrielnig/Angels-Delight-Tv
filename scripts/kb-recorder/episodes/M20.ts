import { money, menu, link, see } from '../money-steps';

export default money({
  id: 'M20',
  title: 'What viewers see of a sponsor',
  role: 'editor',
  screens: ['/admin/sponsors/[id]'],
  actions: ['sponsor.manage'],
  covers: { settings: ['sponsors.label', 'sponsors.link_new_tab', 'sponsors.rotation', 'sponsors.freq.home_banner_per_day', 'sponsors.freq.title_card_per_day', 'sponsors.freq.player_after_per_session', 'sponsors.freq.player_before_per_session'] },
  dependsOn: ['apps/web/src/components/sponsor', 'packages/theme/src/settings-monetization.ts'],
  next: 'M21 Kids safety rules for sponsors and gifts',
  steps: [
    menu('Sponsors', 'Sponsors'),
    link('Demo Sponsor Ltd (test)'),
    see('Demo thank you message (test)', 'shows as the creative headline', { name: 'creative', alt: 'The sponsor creative with its placements, marked 1', marks: [[['text', 'Demo thank you message (test)'], 'What viewers read']] }),
    see('Home page banner', 'shows as one of its places', { name: 'places', alt: 'The places ticked for this creative, marked 1', marks: [[['text', 'Home page banner'], 'Where it shows']] }),
  ],
});
