import { money, menu, link, type, button, see } from '../money-steps';

export default money({
  id: 'M19',
  title: 'Sponsors we do not accept',
  role: 'editor',
  screens: ['/admin/sponsors/[id]'],
  actions: ['sponsor.manage'],
  dependsOn: ['apps/web/src/components/admin/SponsorForm.tsx'],
  next: 'M20 What viewers see of a sponsor',
  steps: [
    menu('Sponsors', 'Sponsors'),
    link('Demo Bakery (test)'),
    type('Notes', 'Checked against our sponsor rules. Fine to run.', { name: 'notes', alt: 'The Notes box with Save sponsor marked 1', marks: [[['label', 'Notes'], 'Your check'], [['button', 'Save sponsor'], 'Save']] }),
    button('Save sponsor', undefined, '', 1500),
    see('Sponsor saved.', 'shows at the bottom of the screen'),
  ],
});
