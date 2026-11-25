import type { Episode } from '../episode';
import { clickByName, highlight, markLabel, openSiteSettings, openTab, padSteps, saveChanges, typeInto, waitForToast } from '../c3-helpers';

const episode: Episode = {
  id: 'C05',
  title: 'Home and Discovery settings',
  role: 'admin',
  screens: ['/admin/site-settings'],
  actions: ['settings.site'],
  covers: {
    settings: [
      'home.hero_interval_seconds', 'home.hero_wait_for_clip', 'home.hero_clip_seconds', 'home.hero_sound', 'home.hero_max_loops',
      'home.hero_previews', 'home.hero_previews_unknown_connection', 'home.hero_previews_min_downlink_mbps', 'home.hero_fallback_count',
      'home.view_all_label', 'home.continue_title', 'seo.site_description', 'seo.default_social_image_url', 'seo.share_text_template',
      
    ],
  },
  dependsOn: ['apps/web/src/components/admin/site/SiteSettingsView.tsx', 'apps/web/src/components/admin/site/DiscoveryTab.tsx', 'packages/theme/src/settings-registry.ts'],
  next: 'C06 Edit the legal and About pages',
  steps: padSteps([
    {
      caption: 'Click **Site settings** in the side menu.',
      run: async (s) => { await openSiteSettings(s); },
    },
    {
      caption: 'Click **Home** at the top.',
      run: async (s) => { await openTab(s, 'Home'); },
      shot: {
        name: 'home-tab',
        alt: 'The Home tab with the Seconds per hero slide box marked 1',
        marks: [markLabel('Seconds per hero slide', 'Seconds per hero slide')],
      },
    },
    {
      caption: 'Type "15" in the **Seconds per hero slide** box.',
      note: 'Choose 5 to 60 seconds. Each hero slide stays this long.',
      run: async (s) => typeInto(s, 'Seconds per hero slide', '15'),
    },
    {
      caption: 'Untick **Sound button on hero clips**.',
      note: 'Clips always start muted. This only controls whether viewers see an Unmute button.',
      run: async (s) => { await clickByName(s, 'switch', 'Sound button on hero clips'); },
      shot: {
        name: 'hero-sound',
        alt: 'The sound button switch turned off and marked 1',
        marks: [markLabel('Sound button on hero clips', 'Sound button', 'switch')],
      },
    },
    {
      caption: 'Type "Keep learning" in the **Continue row title** box.',
      note: 'This is the title of the row of videos a viewer has started.',
      run: async (s) => typeInto(s, 'Continue row title', 'Keep learning'),
    },
    {
      caption: 'Click **Save changes**.',
      run: async (s) => { await saveChanges(s); await waitForToast(s, 'Home settings saved.'); },
    },
    {
      caption: 'Click **Discovery** at the top.',
      note: 'This tab sets how the site looks in search results and when a link is shared.',
      run: async (s) => { await openTab(s, 'Discovery'); },
    },
    {
      caption: 'Type "Free video lessons for learners at home." in the **Site description** box.',
      note: 'Keep it under 160 characters.',
      run: async (s) => typeInto(s, 'Site description', 'Free video lessons for learners at home.'),
    },
    {
      caption: 'Check the preview shows **Angels Delight TV** as the name.',
      note: 'The two previews show how the site looks in a search result and in a shared link. Use Hide previews to close them.',
      run: async (s) => highlight(s, s.page.getByRole('region', { name: 'Search result preview' }), 2600),
      shot: {
        name: 'previews',
        alt: 'The search result and share card previews marked 1',
        marks: [{ target: (s) => s.page.getByRole('region', { name: 'Search result preview' }), label: 'Search preview' }],
      },
    },
    {
      caption: 'Click **Save changes**.',
      run: async (s) => { await saveChanges(s); await waitForToast(s, 'Discovery settings saved.'); },
    },
  ]),
};
export default episode;
