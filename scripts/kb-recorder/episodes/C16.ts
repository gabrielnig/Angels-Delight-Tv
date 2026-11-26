import type { Episode } from '../episode';
import { clickByName, markLabel, openSiteSettings, openTab, padSteps, saveChanges, waitForToast } from '../c3-helpers';

const episode: Episode = {
  id: 'C16',
  title: 'Choose which share options show and their order',
  role: 'admin',
  screens: [],
  actions: ['settings.site'],
  dependsOn: ['apps/web/src/components/admin/site/DiscoveryTab.tsx', 'packages/theme/src/settings-discovery.ts'],
  next: 'W15 See how often your titles are shared',
  steps: padSteps([
    {
      caption: 'Click **Site settings** in the side menu.',
      run: async (s) => { await openSiteSettings(s); },
    },
    {
      caption: 'Click **Discovery** at the top.',
      run: async (s) => { await openTab(s, 'Discovery'); },
    },
    {
      caption: 'Scroll to **Share options**.',
      note: 'Each row is one way to share. The switch turns it on or off, and the order of the rows is the order viewers see.',
      run: async (s) => { await s.reveal(s.page.getByText('Share options', { exact: true }).first(), 0.3); },
      shot: {
        name: 'order',
        alt: 'The Share options list with an Up and Down button and a switch on each row, marked 1',
        marks: [markLabel('Move WhatsApp down', 'Down button', 'button')],
      },
    },
    {
      caption: 'Click **Move WhatsApp down**.',
      note: 'The first row has no Up button and the last row has no Down button, because they cannot move further.',
      run: async (s) => { await clickByName(s, 'button', 'Move WhatsApp down'); },
    },
    {
      caption: 'Click **Move Email up**.',
      run: async (s) => { await clickByName(s, 'button', 'Move Email up'); },
    },
    {
      caption: 'Untick **Telegram**.',
      note: 'A switched off option disappears from the Share sheet. Copy link is always first and the device menu is always last.',
      run: async (s) => { await clickByName(s, 'switch', 'Telegram'); },
    },
    {
      caption: 'Click **Save changes**.',
      run: async (s) => { await saveChanges(s); await waitForToast(s, 'Discovery settings saved.'); },
    },
  ]),
};
export default episode;
