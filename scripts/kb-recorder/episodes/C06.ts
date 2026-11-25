import type { Episode } from '../episode';
import { clickByName, highlight, markLabel, openSiteSettings, openTab, padSteps, waitForToast } from '../c3-helpers';

const episode: Episode = {
  id: 'C06',
  title: 'Edit the legal and About pages',
  role: 'admin',
  screens: ['/admin/site-settings'],
  actions: ['settings.site'],
  covers: { settings: ['legal.terms_version', 'legal.privacy_version'] },
  dependsOn: ['apps/web/src/components/admin/site/PagesEditor.tsx', 'packages/theme/src/settings-registry.ts'],
  next: 'C07 Invite codes for early access',
  steps: padSteps([
    {
      caption: 'Click **Site settings** in the side menu.',
      run: async (s) => { await openSiteSettings(s); },
    },
    {
      caption: 'Click **Pages** at the top.',
      run: async (s) => { await openTab(s, 'Pages'); },
      shot: {
        name: 'pages',
        alt: 'The Pages tab with the placeholder warning marked 1',
        marks: [{ target: (s) => s.page.getByText('Placeholder text.').first(), label: 'Placeholder warning' }],
      },
    },
    {
      caption: 'Check the **Placeholder text.** warning.',
      note: 'The Terms page and Privacy page start with placeholder text. Replace it before you launch.',
      run: async (s) => highlight(s, s.page.getByText('Placeholder text.').first(), 2000),
    },
    {
      caption: 'Click **Bulleted list** in the formatting bar.',
      note: 'The bar also has Bold, Italic, Heading and Link. Select text first, then click the tool.',
      run: async (s) => { await clickByName(s, 'button', 'Bulleted list'); },
    },
    {
      caption: 'Click **Preview** to see what viewers will read.',
      run: async (s) => { await clickByName(s, 'button', 'Preview', { exact: true }); },
      shot: {
        name: 'preview',
        alt: 'The page preview with the Edit button marked 1',
        marks: [markLabel('Edit', 'Edit', 'button')],
      },
    },
    {
      caption: 'Click **Edit** to go back to the text.',
      run: async (s) => { await clickByName(s, 'button', 'Edit', { exact: true }); },
    },
    {
      caption: 'Click **Save draft**.',
      note: 'A draft is only for you. Viewers keep seeing the live version.',
      run: async (s) => { await clickByName(s, 'button', 'Save draft'); await s.pause(800); },
    },
    {
      caption: 'Click **Save new version** to publish it.',
      note: 'Each save makes a numbered version. The newest one is live.',
      run: async (s) => { await clickByName(s, 'button', 'Save new version'); await s.pause(1200); },
      shot: {
        name: 'versions',
        alt: 'The Versions list with the live version marked 1',
        marks: [{ target: (s) => s.page.getByRole('complementary', { name: 'Versions' }), label: 'Versions' }],
      },
    },
  ]),
};
export default episode;
