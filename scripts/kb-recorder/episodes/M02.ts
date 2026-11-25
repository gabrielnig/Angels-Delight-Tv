import { money, menu, see, switchOn, type, button } from '../money-steps';

export default money({
  id: 'M02',
  title: 'Turn sponsors on',
  role: 'admin',
  screens: ['/admin/sponsors'],
  actions: ['sponsor.activate'],
  covers: { settings: ['sponsors.enabled'] },
  dependsOn: ['apps/web/src/components/admin/MasterSwitchCard.tsx', 'apps/web/src/components/admin/ReauthDialog.tsx'],
  next: 'M03 Add a sponsor and its images',
  notes: { 4: ['TIP','Type your own password, not the words in quotes. You are asked again only after 10 minutes.'], 7: ['NOTE','Turning the switch off works the same way. Live sponsors stay Live, but nobody sees them.'] },
  steps: [
    menu('Sponsors', 'Sponsors'),
    see('Sponsors are off. Viewers see nothing.', 'shows beside the switch'),
    switchOn('Show sponsors on the site', { name: 'ask', alt: 'The switch card marked 1', marks: [[['switch', 'Show sponsors on the site'], 'The master switch']] }),
    type('Password', 'your password', { name: 'password', alt: 'The password box marked 1', marks: [[['label', 'Password'], 'Password box']] }),
    button('Confirm'),
    see('Sponsors are on.', 'shows beside the switch', { name: 'on', alt: 'The switch card saying sponsors are on, marked 1', marks: [[['text', 'Sponsors are on.'], 'Switch note']] }),
    switchOn('Show sponsors on the site'),
    type('Password', 'your password'),
    button('Confirm'),
    see('Sponsors are off. Viewers see nothing.', 'shows again'),
  ],
});
