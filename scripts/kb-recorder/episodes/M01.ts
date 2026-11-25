import { money, menu, see, link } from '../money-steps';

export default money({
  id: 'M01',
  title: 'How sponsors and donations work',
  role: 'editor',
  screens: ['/admin/sponsors'],
  actions: ['sponsor.manage'],
  covers: { nav: ['Sponsors'] },
  dependsOn: ['apps/web/src/app/admin/(shell)/sponsors', 'apps/web/src/components/admin/MasterSwitchCard.tsx'],
  next: 'M02 Turn sponsors on',
  steps: [
    menu('Sponsors', 'Sponsors', { name: 'sponsors', alt: 'The Sponsors screen with the switch card marked 1 and the sponsor list marked 2', marks: [[['switch', 'Show sponsors on the site'], 'Switch'], [['link', 'Demo Sponsor Ltd (test)'], 'Sponsor list']] }),
    see('Sponsors never show to children', 'appears under the title'),
    see('Sponsors are off. Viewers see nothing.', 'shows beside the switch', { name: 'off', alt: 'The switch card saying sponsors are off, marked 1', marks: [[['text', 'Sponsors are off. Viewers see nothing.'], 'Switch note']] }),
    see('Demo Sponsor Ltd (test)', 'shows in the list'),
    link('Demo Sponsor Ltd (test)', { name: 'detail', alt: 'The sponsor screen with the status buttons marked 1', marks: [[['button', 'Pause'], 'Status buttons']] }),
    see('Pause', 'shows in the status panel'),
    link('Report', { name: 'report', alt: 'The sponsor report with the number tiles marked 1', marks: [[['text', 'Impressions'], 'Numbers']] }),
    see('Impressions', 'shows at the top of the report'),
  ],
});
