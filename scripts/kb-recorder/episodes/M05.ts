import { money, menu, link, button, see } from '../money-steps';

export default money({
  id: 'M05',
  title: 'Pause, archive or delete a sponsor',
  role: 'admin',
  screens: ['/admin/sponsors/[id]'],
  actions: ['sponsor.activate'],
  dependsOn: ['apps/web/src/components/admin/SponsorStatusPanel.tsx'],
  next: 'M06 Read a sponsor report and print it',
  notes: { 3: ['NOTE','Pause keeps everything. Use Approve to run to start it again.'], 7: ['CAREFUL','Archive hides the sponsor for good, but its report numbers stay.'], 11: ['CAREFUL','Delete cannot be undone, and it is refused for a sponsor that has report numbers. Archive it instead.'] },
  steps: [
    menu('Sponsors', 'Sponsors'),
    link('Demo Sponsor Ltd (test)', { name: 'live', alt: 'A live sponsor with Pause, Archive and Delete sponsor marked 1', marks: [[['button', 'Pause'], 'Pause'], [['button', 'Archive'], 'Archive']] }),
    button('Pause', undefined, '', 1200),
    see('Sponsor paused.', 'shows at the bottom of the screen', { name: 'paused', alt: 'The sponsor paused, with Approve to run marked 1', marks: [[['button', 'Approve to run'], 'Start it again']] }),
    button('Approve to run', undefined, '', 1200),
    see('Sponsor approved.', 'shows at the bottom of the screen'),
    button('Archive', undefined, '', 1200),
    see('Sponsor archived.', 'shows at the bottom of the screen'),
    link('Sponsors', undefined, ' in the top path'),
    link('Demo Bakery (test)'),
    button('Delete sponsor', { name: 'delete', alt: 'The Delete sponsor box asking you to confirm, marked 1', marks: [[['button', 'Delete'], 'Confirm']] }),
    button('Delete', undefined, '', 1500),
  ],
});
