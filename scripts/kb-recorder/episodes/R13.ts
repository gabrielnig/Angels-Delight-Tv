import type { Episode } from '../episode';
import { highlight, waitForToast } from '../helpers';
import { menuTo, slow } from '../helpers-c7';

/** R13: set the contact that the Message ARKDEV button uses. */
const episode: Episode = {
  id: 'R13',
  title: 'Set the contact for the developer',
  role: 'admin',
  screens: ['/admin/site-settings'],
  actions: ['settings.site'],
  covers: { nav: ['Site settings'], settings: ['help.support_contact'] },
  dependsOn: ['apps/web/src/components/admin/site/SiteSettingsView.tsx', 'apps/web/src/components/admin/help/SupportStrip.tsx'],
  steps: [
    {
      caption: 'Choose **Site settings** in the side menu.',
      run: async (s) => {
        await menuTo(s, 'Site settings');
        await s.page.getByRole('heading', { name: 'Site settings' }).first().waitFor();
      },
    },
    {
      caption: 'Type "help@example.com" in the **Help centre contact** box.',
      note: 'Use an email address or a link that starts with https. Use the contact ARKDEV gave you, not the example.',
      run: async (s) => {
        await s.type(s.page.getByLabel('Help centre contact'), 'help@example.com');
      },
      shot: {
        name: 'contact',
        alt: 'The Platform details card with the Help centre contact box marked 1',
        marks: [{ target: (s) => s.page.getByLabel('Help centre contact'), label: 'Help centre contact' }],
      },
    },
    {
      caption: 'Click **Save changes**.',
      run: async (s) => {
        await s.click(s.page.getByRole('button', { name: 'Save changes' }).first());
        await waitForToast(s, /saved/i);
      },
    },
    {
      caption: 'Choose **Help centre** in the side menu.',
      run: async (s) => {
        await menuTo(s, 'Help centre');
        await s.page.getByRole('link', { name: 'Message ARKDEV' }).waitFor();
      },
    },
    {
      caption: 'Scroll to **Message ARKDEV** at the bottom of the page.',
      run: async (s) => {
        await s.reveal(s.page.getByRole('link', { name: 'Message ARKDEV' }), 0.4);
        await highlight(s, s.page.getByRole('link', { name: 'Message ARKDEV' }));
      },
      shot: {
        name: 'strip',
        alt: 'The Message ARKDEV button on the Help centre home page marked 1',
        marks: [{ target: (s) => s.page.getByRole('link', { name: 'Message ARKDEV' }), label: 'Message ARKDEV' }],
      },
    },
  ],
};

export default slow(episode, 1800);
