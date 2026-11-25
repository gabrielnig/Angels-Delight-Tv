import type { Episode } from '../episode';
import { clickByName, goToScreen, highlight, padSteps, typeInto, waitForToast } from '../c3-helpers';

const episode: Episode = {
  id: 'W05',
  title: 'Choose hero banners and preview clips',
  role: 'admin',
  screens: [],
  actions: ['home.curate', 'preview.backfill'],
  dependsOn: ['apps/web/src/components/admin/HomeCuration.tsx', 'apps/web/src/components/admin/HeroSlots.tsx', 'apps/web/src/components/admin/PreviewBackfillCard.tsx'],
  next: 'W06',
  steps: padSteps([
    {
      caption: 'Click **Home curation** in the side menu.',
      run: async (s) => {
        await goToScreen(s, 'Home curation');
        await s.page.getByRole('heading', { name: 'Home curation' }).first().waitFor();
      },
    },
    {
      caption: 'Check the **Hero titles** card.',
      note: 'The hero is the big banner at the top of Home. You can choose up to 5 titles. With none chosen, Home shows your 5 newest.',
      run: async (s) => highlight(s, s.page.getByRole('heading', { name: 'Hero titles' }), 1800),
      shot: {
        name: 'hero',
        alt: 'The Hero titles card marked 1',
        marks: [{ target: (s) => s.page.getByRole('heading', { name: 'Hero titles' }), label: 'Hero titles' }],
      },
    },
    {
      caption: 'Select **Why the Sky Is Blue** from the **Add hero title** list.',
      run: async (s) => {
        const sel = s.page.getByLabel('Add hero title', { exact: true });
        await s.click(sel);
        await sel.selectOption({ label: 'Why the Sky Is Blue' });
        await s.pause(500);
      },
    },
    {
      caption: 'Type "Why is the sky blue?" in the **Headline for Why the Sky Is Blue** box.',
      note: 'Leave the headline blank to use the video title.',
      run: async (s) => typeInto(s, 'Headline for Why the Sky Is Blue', 'Why is the sky blue?'),
    },
    {
      caption: 'Type "Light and colour." in **Description for Why the Sky Is Blue**.',
      run: async (s) => typeInto(s, 'Description for Why the Sky Is Blue', 'Light and colour.'),
    },
    {
      caption: 'Type "Watch now" in the **Button label for Why the Sky Is Blue** box.',
      note: 'Leave the button label blank to use Play.',
      run: async (s) => typeInto(s, 'Button label for Why the Sky Is Blue', 'Watch now'),
      shot: {
        name: 'slide-text',
        alt: 'The slide text boxes for one hero title marked 1',
        marks: [{ target: (s) => s.page.getByLabel('Headline for Why the Sky Is Blue', { exact: true }), label: 'Slide text' }],
      },
    },
    {
      caption: 'Click **Generate previews for all videos**.',
      note: 'This makes the short silent clip for every published video that has none. Only Admins can do this. Clips appear as each one finishes, about a minute each.',
      run: async (s) => { await clickByName(s, 'button', 'Generate previews for all videos'); await s.page.getByRole('status').filter({ hasText: /Queued|Nothing to queue/ }).first().waitFor(); },
      shot: {
        name: 'previews',
        alt: 'The Hero clips card with the Generate previews button marked 1',
        marks: [{ target: (s) => s.page.getByRole('button', { name: 'Generate previews for all videos' }), label: 'Generate previews' }],
      },
    },
    {
      caption: 'Click **Save draft**.',
      run: async (s) => { await clickByName(s, 'button', 'Save draft'); await waitForToast(s, 'Draft saved.'); },
    },
    {
      caption: 'Click **Publish changes**.',
      run: async (s) => { await clickByName(s, 'button', 'Publish changes'); await waitForToast(s, 'Home page published.'); },
    },
  ]),
};
export default episode;
