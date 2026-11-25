import type { Episode } from '../episode';
import { clickByName, highlight, markLabel, openSiteSettings, openTab, padSteps, saveChanges, typeInto, waitForToast } from '../c3-helpers';

const episode: Episode = {
  id: 'C10',
  title: 'Maintenance mode and the notice banner',
  role: 'super_admin',
  screens: ['/admin/site-settings'],
  actions: ['settings.site', 'settings.flags'],
  covers: { settings: ['maintenance.banner', 'maintenance.mode'] },
  dependsOn: ['apps/web/src/components/admin/site/SiteSettingsView.tsx', 'packages/theme/src/settings-registry.ts'],
  next: 'C11 Invite a teammate and choose their role',
  steps: padSteps([
    {
      caption: 'Click **Site settings** in the side menu.',
      run: async (s) => { await openSiteSettings(s); },
    },
    {
      caption: 'Click **Maintenance** at the top.',
      run: async (s) => { await openTab(s, 'Maintenance'); },
      shot: {
        name: 'maintenance',
        alt: 'The Maintenance tab with the notice banner switch marked 1',
        marks: [markLabel('Show the notice banner', 'Notice banner', 'switch'), markLabel('Maintenance mode', 'Maintenance mode', 'switch')],
      },
    },
    {
      caption: 'Tick **Show the notice banner**.',
      note: 'The banner is a slim strip shown on every page. The site stays open.',
      run: async (s) => { await clickByName(s, 'switch', 'Show the notice banner'); },
    },
    {
      caption: 'Type "Short break tonight from 11pm to 12am." in the **Banner message** box.',
      note: 'Keep it short and plain. The limit is 200 characters.',
      run: async (s) => typeInto(s, 'Banner message', 'Short break tonight from 11pm to 12am.'),
    },
    {
      caption: 'Click **Save changes**.',
      run: async (s) => { await saveChanges(s); await waitForToast(s, 'Maintenance settings saved.'); },
    },
    {
      caption: 'Tick **Maintenance mode**.',
      note: 'This closes the site to viewers. Only Super admins can turn it on.',
      run: async (s) => { await clickByName(s, 'switch', 'Maintenance mode'); },
    },
    {
      caption: 'Check the **Unsaved changes** badge.',
      note: 'The badge shows that your last change is waiting to be saved.',
      run: async (s) => highlight(s, s.page.getByText('Unsaved changes').first(), 1600),
    },
    {
      caption: 'Click **Save changes** to continue.',
      run: async (s) => { await saveChanges(s); await s.page.getByRole('dialog').waitFor(); },
      shot: {
        name: 'confirm',
        alt: 'The confirmation box with the Turn on button marked 1',
        marks: [{ target: (s) => s.page.getByRole('button', { name: 'Turn on', exact: true }), label: 'Turn on' }],
      },
    },
    {
      caption: 'Click **Turn on** to confirm.',
      note: 'Admins can still sign in. Videos that are already playing carry on.',
      run: async (s) => { await clickByName(s, 'button', 'Turn on', { exact: true }); await waitForToast(s, 'Maintenance settings saved.'); },
    },
    {
      caption: 'Untick **Maintenance mode** to open the site again.',
      run: async (s) => { await clickByName(s, 'switch', 'Maintenance mode'); },
    },
    {
      caption: 'Click **Save changes** to finish.',
      note: 'Turning it off needs no confirmation.',
      run: async (s) => { await saveChanges(s); await waitForToast(s, 'Maintenance settings saved.'); },
    },
  ]),
};
export default episode;
