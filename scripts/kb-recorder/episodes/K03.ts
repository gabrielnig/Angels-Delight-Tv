import type { Episode } from '../episode';
import { clickByName, highlight, openSiteSettings, openTab, padSteps, saveChanges, typeInto, waitForToast } from '../c3-helpers';

const episode: Episode = {
  id: 'K03',
  title: 'Let visitors watch without an account',
  role: 'super_admin',
  screens: [],
  actions: ['settings.flags'],
  dependsOn: ['apps/web/src/components/admin/site/SiteSettingsView.tsx', 'packages/theme/src/settings-registry.ts'],
  next: 'K04',
  steps: padSteps([
    {
      caption: 'Click **Site settings** in the side menu.',
      run: async (s) => { await openSiteSettings(s); },
    },
    {
      caption: 'Click **Features and limits** at the top.',
      run: async (s) => { await openTab(s, 'Features and limits'); },
    },
    {
      caption: 'Check the hint under **Guests can watch**.',
      note: 'On means anyone can watch without an account. Off means visitors can browse but must sign in to play.',
      run: async (s) => highlight(s, s.page.getByText('Guests can watch', { exact: true }).first(), 2400),
      shot: {
        name: 'guests',
        alt: 'The Guests can watch switch marked 1',
        marks: [{ target: (s) => s.page.getByRole('switch', { name: 'Guests can watch', exact: true }), label: 'Guests can watch' }],
      },
    },
    {
      caption: 'Untick **Guests can watch**.',
      note: 'Turn it back on the same way. Visitors keep their progress on their own device only.',
      run: async (s) => { await clickByName(s, 'switch', 'Guests can watch'); },
    },
    {
      caption: 'Type "10" in the **Guest video link minutes** box.',
      note: 'A guest video link works this long before the player renews it. Choose 5 to 120 minutes. The default is 20.',
      run: async (s) => typeInto(s, 'Guest video link minutes', '10'),
    },
    {
      caption: 'Click **Save changes**.',
      run: async (s) => { await saveChanges(s); await waitForToast(s, 'Features and limits saved.'); },
      shot: {
        name: 'saved',
        alt: 'The saved message',
        marks: [{ target: (s) => s.page.getByRole('status').filter({ hasText: 'saved' }).first(), label: 'Saved' }],
      },
    },
  ]),
};
export default episode;
