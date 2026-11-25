import { money, menu, link, type, tick, button, see } from '../money-steps';

export default money({
  id: 'M04',
  title: 'Choose where a sponsor shows and for how long',
  role: 'admin',
  screens: ['/admin/sponsors/[id]'],
  actions: ['sponsor.activate'],
  covers: { settings: ['sponsors.placement.home_banner.enabled', 'sponsors.placement.title_card.enabled', 'sponsors.placement.player_after.enabled', 'sponsors.placement.player_before.enabled', 'sponsors.home_banner.after_row', 'sponsors.player_before.seconds'] },
  dependsOn: ['apps/web/src/components/admin/CreativesEditor.tsx', 'apps/web/src/components/admin/SponsorStatusPanel.tsx'],
  next: 'M05 Pause, archive or delete a sponsor',
  notes: { 4: ['TIP','Tick every place the sponsor paid for. A message with no place ticked never shows.'], 7: ['NOTE','Type the day, month and year with no spaces, for example 10102026 for 10 Oct 2026. Dates use Lagos time.'], 9: ['CAREFUL','Only Admins can approve. The sponsors master switch must also be on for viewers to see anything.'] },
  steps: [
    menu('Sponsors', 'Sponsors'),
    link('Demo Bakery (test)', { name: 'draft', alt: 'The Demo Bakery sponsor with its status buttons marked 1', marks: [[['button', 'Approve to run'], 'Approve to run']] }),
    button('Edit', { name: 'edit', alt: 'The creative form with the four placement boxes marked 1', marks: [[['label', 'Home page banner'], 'Placements']] }, '', 600, 'Home page banner'),
    tick('Home page banner'),
    tick('After the video', { name: 'ticked', alt: 'Two placements ticked, marked 1', marks: [[['label', 'After the video'], 'Ticked places']] }),
    button('Save creative', undefined, '', 1500),
    type('Ends on', '10102026', { name: 'dates', alt: 'The Ends on box marked 1', marks: [[['label', 'Ends on'], 'Last day']] }),
    button('Save sponsor', undefined, '', 1500),
    button('Approve to run', undefined, '', 1500),
    see('Live', 'shows beside the sponsor name', { name: 'live', alt: 'The sponsor page with the Live badge marked 1', marks: [[['text', 'Live'], 'Status']] }),
  ],
});
