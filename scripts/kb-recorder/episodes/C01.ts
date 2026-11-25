import type { Episode } from '../episode';
import { padSteps, checklist, clickByName, highlight, markLabel, openSiteSettings, saveChanges, typeInto, waitForToast } from '../c3-helpers';

const episode: Episode = {
  id: 'C01',
  title: 'Platform details and the Launch checklist',
  role: 'admin',
  screens: ['/admin/site-settings'],
  actions: ['settings.site'],
  covers: {
    nav: ['Site settings'],
    settings: ['platform.name', 'platform.tagline', 'platform.support_email', 'platform.footer_text', 'platform.canonical_host', 'content.default_language', 'platform.social_links'],
  },
  dependsOn: ['apps/web/src/components/admin/site/SiteSettingsView.tsx', 'packages/theme/src/settings-registry.ts', 'apps/web/src/app/admin/(shell)/site-settings'],
  next: 'C02 Colours, fonts and logo with the Theme editor',
  steps: padSteps([
    {
      caption: 'Click **Site settings** in the side menu.',
      note: 'Admins and Super admins can open this screen. Editors do not see it.',
      run: async (s) => {
        await openSiteSettings(s);
        await s.page.getByRole('heading', { name: 'Site settings' }).first().waitFor();
      },
      shot: {
        name: 'site-settings',
        alt: 'Site settings with the Launch checklist marked 1',
        marks: [{ target: (s) => checklist(s), label: 'Launch checklist' }],
      },
    },
    {
      caption: 'Check the **Launch checklist** on the right.',
      note: 'Each line with a warning sign is something still to set before you launch.',
      run: async (s) => highlight(s, checklist(s), 2200),
    },
    {
      caption: 'Type "Free lessons for every home" in the **Tagline** box.',
      run: async (s) => typeInto(s, 'Tagline', 'Free lessons for every home'),
      holdMs: 800,
    },
    {
      caption: 'Type "help@example.org" in the **Support email** box.',
      note: 'Viewers use this address to reach you. Use an address that someone reads every day.',
      run: async (s) => typeInto(s, 'Support email', 'help@example.org'),
      holdMs: 800,
    },
    {
      caption: 'Type "lessons.example.org" in the **Domain** box.',
      note: 'Type the web address without https://. Your developer connects the domain itself.',
      run: async (s) => typeInto(s, 'Domain', 'lessons.example.org'),
      holdMs: 800,
      shot: {
        name: 'details-filled',
        alt: 'Platform details with the Tagline, Support email and Domain boxes filled in',
        marks: [markLabel('Tagline', 'Tagline'), markLabel('Support email', 'Support email'), markLabel('Domain', 'Domain')],
      },
    },
    {
      caption: 'Click **Save changes** to keep your edits.',
      run: async (s) => {
        await saveChanges(s);
        await waitForToast(s, 'Settings saved.');
      },
    },
    {
      caption: 'Check the **Launch checklist** again.',
      note: 'The items you filled in now say Done.',
      run: async (s) => highlight(s, checklist(s), 2600),
      shot: {
        name: 'checklist-updated',
        alt: 'The Launch checklist with fewer items not set',
        marks: [{ target: (s) => checklist(s), label: 'Updated checklist' }],
      },
    },
  ]),
};

export default episode;
