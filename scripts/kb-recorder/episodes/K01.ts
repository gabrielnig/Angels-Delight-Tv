import type { Episode } from '../episode';
import { goToScreen } from '../helpers';
import { pointAt, settle } from '../safety-helpers';

/** K01: give a video the G rating so Kids profiles can watch it. */
const episode: Episode = {
  id: 'K01',
  title: 'Make a video safe for Kids mode',
  role: 'editor',
  screens: ['/admin/videos', '/admin/videos/[id]'],
  actions: ['video.edit'],
  dependsOn: [
    'apps/web/src/components/admin/VideoEditor.tsx',
    'apps/web/src/components/admin/VideosList.tsx',
  ],
  next: 'K02 Maturity ratings and the highest rating guests can see',
  steps: [
    {
      caption: 'Choose **Videos** in the side menu.',
      note: 'Editors, Admins and Super admins can all do this.',
      run: async (s) => {
        await goToScreen(s, 'Videos');
        await s.page.getByRole('heading', { name: 'Videos' }).first().waitFor();
      },
      shot: {
        name: 'videos-list',
        alt: 'The Videos list with the Search box marked 1',
        marks: [
          {
            target: (s) => s.page.getByLabel('Search', { exact: true }).first(),
            label: 'Search for the video',
          },
        ],
      },
    },
    {
      caption: 'Type "Counting" in the **Search** box.',
      run: async (s) => {
        await s.type(s.page.getByLabel('Search', { exact: true }).first(), 'Counting');
        await s.page.getByRole('link', { name: 'Counting Money in Naira' }).first().waitFor();
        await s.pause(800);
      },
    },
    {
      caption: 'Click **Counting Money in Naira** to open the video.',
      run: async (s) => {
        await s.click(s.page.getByRole('link', { name: 'Counting Money in Naira' }).first());
        await s.page.getByRole('heading', { name: 'Details' }).waitFor();
        await settle(s);
      },
    },
    {
      caption: 'Scroll to **Maturity rating**.',
      note: 'G is the only rating that Kids profiles can see.',
      run: async (s) => {
        await s.reveal(s.page.getByLabel('Maturity rating'), 0.4);
        await pointAt(s, s.page.getByLabel('Maturity rating'));
      },
    },
    {
      caption: 'Select **G** from **Maturity rating**.',
      note: 'Choose G only when a parent would be happy for a child to watch alone.',
      run: async (s) => {
        await s.click(s.page.getByLabel('Maturity rating'));
        await s.page.getByLabel('Maturity rating').selectOption({ label: 'G' });
        await s.pause(600);
      },
      shot: {
        name: 'rating-g',
        alt: 'The Maturity rating list set to G, marked 1',
        marks: [{ target: (s) => s.page.getByLabel('Maturity rating'), label: 'Maturity rating' }],
      },
    },
    {
      caption: 'Click **Save changes**.',
      run: async (s) => {
        await s.click(s.page.getByRole('button', { name: 'Save changes' }));
        await s.page.getByText('Changes saved.').first().waitFor();
        await settle(s, 1200);
      },
      shot: {
        name: 'saved',
        alt: 'The message Changes saved, with the Save changes button marked 1',
        marks: [{ target: (s) => s.page.getByRole('button', { name: 'Save changes' }), label: 'Save changes' }],
      },
    },
    {
      caption: 'Scroll to **Before you publish**.',
      note: 'A rating is one of the steps a video needs before it can be published.',
      run: async (s) => {
        await s.reveal(s.page.getByText('Before you publish').first(), 0.3);
        await pointAt(s, s.page.getByText('Before you publish').first());
      },
    },
    {
      caption: 'Scroll to **How viewers see it**.',
      run: async (s) => {
        await s.reveal(s.page.getByText('How viewers see it').first(), 0.3);
        await pointAt(s, s.page.getByText('How viewers see it').first());
      },
    },
  ],
};

export default episode;
