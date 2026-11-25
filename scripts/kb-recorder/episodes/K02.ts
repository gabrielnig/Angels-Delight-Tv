import type { Episode } from '../episode';
import { goToScreen } from '../helpers';
import { pointAt, settle } from '../safety-helpers';

/** K02: choose a maturity rating, and see where Publish asks for one. */
const episode: Episode = {
  id: 'K02',
  title: 'Maturity ratings and the highest rating guests can see',
  role: 'editor',
  screens: ['/admin/videos', '/admin/videos/[id]'],
  actions: ['video.edit', 'video.publish'],
  dependsOn: [
    'apps/web/src/components/admin/VideoEditor.tsx',
    'apps/web/src/components/admin/PublishDialog.tsx',
    'packages/shared/src/maturity.ts',
  ],
  next: 'K09 Set one rating for a series or many videos',
  steps: [
    {
      caption: 'Choose **Videos** in the side menu.',
      run: async (s) => {
        await goToScreen(s, 'Videos');
        await s.page.getByRole('heading', { name: 'Videos' }).first().waitFor();
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
      note: 'The five ratings run from G, for everyone, up to 18, for adults only.',
      run: async (s) => {
        await s.reveal(s.page.getByLabel('Maturity rating'), 0.4);
        await pointAt(s, s.page.getByLabel('Maturity rating'));
      },
      shot: {
        name: 'rating-list',
        alt: 'The Maturity rating list on the video screen, marked 1',
        marks: [{ target: (s) => s.page.getByLabel('Maturity rating'), label: 'Maturity rating' }],
      },
    },
    {
      caption: 'Click **Publish**.',
      note: 'A video cannot go live without a rating. Publish asks for one if it is missing.',
      run: async (s) => {
        await s.click(s.page.getByRole('button', { name: 'Publish', exact: true }).first());
        await s.page.getByRole('dialog').waitFor();
        await settle(s);
      },
      shot: {
        name: 'publish-dialog',
        alt: 'The Publish this video box with the Maturity rating (required) list marked 1',
        marks: [
          {
            target: (s) => s.page.getByRole('dialog').getByLabel('Maturity rating (required)'),
            label: 'Rating asked for here',
          },
        ],
      },
    },
    {
      caption: 'Check that **Maturity rating (required)** is in the box.',
      run: async (s) => {
        await pointAt(s, s.page.getByRole('dialog').getByLabel('Maturity rating (required)'));
      },
    },
    {
      caption: 'Select **PG** from **Maturity rating (required)**.',
      note: 'PG means parental guidance. Kids profiles cannot see it.',
      run: async (s) => {
        const list = s.page.getByRole('dialog').getByLabel('Maturity rating (required)');
        await s.click(list);
        await list.selectOption({ label: 'PG' });
        await s.pause(700);
      },
    },
    {
      caption: 'Click **Cancel**.',
      note: 'Cancel so that this video stays a draft. The other steps still need doing.',
      run: async (s) => {
        await s.click(s.page.getByRole('dialog').getByRole('button', { name: 'Cancel' }));
        await settle(s, 500);
      },
    },
    {
      caption: 'Scroll to **Before you publish**.',
      run: async (s) => {
        await s.reveal(s.page.getByText('Before you publish').first(), 0.3);
        await pointAt(s, s.page.getByText('Before you publish').first());
      },
      shot: {
        name: 'checklist',
        alt: 'The Before you publish list, marked 1',
        marks: [{ target: (s) => s.page.getByText('Before you publish').first(), label: 'Publish steps' }],
      },
    },
  ],
};

export default episode;
