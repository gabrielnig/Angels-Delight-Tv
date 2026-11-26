import { money, menu, see, link } from '../money-steps';

export default money({
  id: 'M24',
  title: 'Money questions answered',
  role: 'editor',
  screens: ['/admin/sponsors/new'],
  actions: ['sponsor.manage'],
  dependsOn: ['apps/web/src/components/admin/SponsorForm.tsx'],
  steps: [
    menu('Sponsors', 'Sponsors'),
    see('Sponsors are off. Viewers see nothing.', 'shows beside the switch'),
    link('Add sponsor'),
    see('Staff only. Never shown to viewers.', 'shows under the contact name', { name: 'private', alt: 'The staff only hints under the contact boxes, marked 1', marks: [[['text', 'Staff only. Never shown to viewers.'], 'Staff only']] }),
  ],
});
