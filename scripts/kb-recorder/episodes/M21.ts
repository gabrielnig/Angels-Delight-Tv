import { money, menu, link, see } from '../money-steps';

export default money({
  id: 'M21',
  title: 'Kids safety rules for sponsors and gifts',
  role: 'editor',
  screens: ['/admin/sponsors'],
  actions: ['sponsor.manage'],
  dependsOn: ['apps/web/src/components/admin/MasterSwitchCard.tsx', 'apps/web/src/server/donations/gate.ts'],
  next: 'M22 Monthly giving: not available yet',
  steps: [
    menu('Sponsors', 'Sponsors'),
    see('Sponsors never show to children', 'appears under the title', { name: 'title', alt: 'The Sponsors title line, marked 1', marks: [[['text', 'Sponsors never show to children'], 'Kids rule']] }),
    see('Kids profiles and Kids mode never show sponsors', 'appears', { name: 'switch', alt: 'The kids rule under the switch, marked 1', marks: [[['text', 'Kids profiles and Kids mode never show sponsors'], 'Kids rule']] }),
    link('Demo Sponsor Ltd (test)'),
    link('Report'),
    see('Cards shown to children are never counted', 'shows in the report notes'),
  ],
});
