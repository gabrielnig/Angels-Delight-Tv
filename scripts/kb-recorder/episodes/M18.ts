import { money, menu, link, button, file, type, see } from '../money-steps';

export default money({
  id: 'M18',
  title: 'Sponsor pictures: sizes and descriptions',
  role: 'editor',
  screens: ['/admin/sponsors/[id]'],
  actions: ['sponsor.manage'],
  dependsOn: ['apps/web/src/components/admin/CreativesEditor.tsx', 'apps/web/src/lib/admin/sponsor-image.ts'],
  next: 'M19 Sponsors we do not accept',
  notes: { 4: ['NOTE','The square picture must be at least 400 by 400 pixels. The wide picture must be at least 1200 by 400. Both under 2 MB.'] },
  steps: [
    menu('Sponsors', 'Sponsors'),
    link('Demo Sponsor Ltd (test)'),
    button('Add creative', { name: 'pictures', alt: 'The creative form with the two picture boxes marked 1', marks: [[['label', 'Square picture'], 'Square picture'], [['label', 'Wide picture'], 'Wide picture']] }, '', 600, 'Headline'),
    file('Square picture'),
    file('Wide picture'),
    see('Read aloud by screen readers.', 'appears under the box', { name: 'alt', alt: 'The picture description box with its hint marked 1', marks: [[['label', 'Picture description'], 'Description']] }),
    type('Picture description', 'A friendly welcome card, test only'),
    button('Cancel'),
  ],
});
