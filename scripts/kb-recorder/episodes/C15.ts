import type { Episode } from '../episode';
import { clickByName, highlight, markLabel, openSiteSettings, openTab, padSteps, saveChanges, typeInto, waitForToast } from '../c3-helpers';

const episode: Episode = {
  id: 'C15',
  title: 'Storage notice and sharing options',
  role: 'admin',
  screens: [],
  actions: ['settings.site'],
  covers: { settings: ['seo.indexing', 'seo.share_channels', 'consent.notice_enabled', 'consent.notice_text', 'consent.notice_version'] },
  dependsOn: ['apps/web/src/components/admin/site/DiscoveryTab.tsx', 'packages/theme/src/settings-discovery.ts'],
  next: 'C06 Edit the legal and About pages',
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
      caption: 'Scroll to **Storage notice**.',
      note: 'The storage notice is the short message that tells visitors what the site keeps on their device.',
      run: async (s) => { await s.reveal(s.page.getByText('Storage notice', { exact: true }).first(), 0.3); },
      shot: {
        name: 'notice',
        alt: 'The Storage notice switch and text box marked 1',
        marks: [markLabel('Storage notice', 'Storage notice', 'switch'), markLabel('Storage notice text', 'Notice text')],
      },
    },
    {
      caption: 'Type "We keep small settings on your device." in **Storage notice text**.',
      note: 'Keep the words short and plain. No dashes, emoji or markup.',
      run: async (s) => typeInto(s, 'Storage notice text', 'We keep small settings on your device.'),
    },
    {
      caption: 'Click **Show notice again to everyone**.',
      note: 'Use this after you change the words in a way that matters. Everyone who closed the notice sees it again.',
      run: async (s) => { await clickByName(s, 'button', 'Show notice again to everyone'); },
    },
    {
      caption: 'Scroll to **Let search engines list the site**.',
      note: 'Kids only titles are never listed by search engines, whatever this switch says.',
      run: async (s) => { await s.reveal(s.page.getByText('Let search engines list the site', { exact: true }).first(), 0.3); },
      shot: {
        name: 'sharing',
        alt: 'The search engine switch and share option switches marked 1',
        marks: [markLabel('Let search engines list the site', 'Search engines', 'switch'), markLabel('WhatsApp', 'WhatsApp', 'switch')],
      },
    },
    {
      caption: 'Untick **WhatsApp**.',
      note: 'These switches choose which options the Share menu shows. Copy link is always on.',
      run: async (s) => { await clickByName(s, 'switch', 'WhatsApp'); },
    },
    {
      caption: 'Click **Save changes**.',
      run: async (s) => { await saveChanges(s); await waitForToast(s, 'Discovery settings saved.'); },
    },
  ]),
};
export default episode;
