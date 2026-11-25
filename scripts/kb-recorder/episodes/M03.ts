import { money, menu, link, type, button, file, see } from '../money-steps';

export default money({
  id: 'M03',
  title: 'Add a sponsor and its images',
  role: 'editor',
  screens: ['/admin/sponsors/new', '/admin/sponsors/[id]'],
  actions: ['sponsor.manage'],
  dependsOn: ['apps/web/src/components/admin/SponsorForm.tsx', 'apps/web/src/components/admin/CreativesEditor.tsx'],
  next: 'M04 Choose where a sponsor shows and for how long',
  notes: { 5: ['NOTE','Contact details are for staff only and are stored sealed. Viewers never see them.'], 12: ['TIP','Use a JPG or PNG under 2 MB. The wide picture is optional.'] },
  steps: [
    menu('Sponsors', 'Sponsors'),
    link('Add sponsor', { name: 'form', alt: 'The Add sponsor form with the name box marked 1', marks: [[['label', 'Sponsor name'], 'Sponsor name']] }),
    type('Sponsor name', 'Demo Radio Two (test)'),
    type('Contact name', 'Demo Contact'),
    type('Contact email', 'radio2@example.com'),
    type('Notes', 'Test sponsor for the help videos.', { name: 'filled', alt: 'The sponsor form filled in, with Save sponsor marked 1', marks: [[['button', 'Save sponsor'], 'Save']] }),
    button('Save sponsor', undefined, '', 1500),
    button('Add creative', { name: 'creative', alt: 'The creative form with the picture boxes marked 1', marks: [[['label', 'Square picture'], 'Square picture']] }, '', 600, 'Headline'),
    type('Headline', 'Demo welcome message (test)'),
    type('Short text', 'Welcome to our test sponsor.'),
    type('Link', 'https://example.com/demo'),
    file('Square picture'),
    type('Picture description', 'Welcome picture, test only', { name: 'described', alt: 'The creative form with Save creative marked 1', marks: [[['button', 'Save creative'], 'Save']] }),
    button('Save creative', undefined, '', 1500),
    see('Demo welcome message (test)', 'shows in the sponsor page', { name: 'saved', alt: 'The saved creative on the sponsor page, marked 1', marks: [[['text', 'Demo welcome message (test)'], 'Your creative']] }),
  ],
});
