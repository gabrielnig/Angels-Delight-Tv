import type { Episode } from '../episode';
import { goToScreen } from '../helpers';
import { pointAt, settle } from '../safety-helpers';

/** K09: set one maturity rating on many videos, then on a whole series. */
const episode: Episode = {
  id: 'K09',
  title: 'Set one rating for a series or many videos',
  role: 'editor',
  screens: ['/admin/videos', '/admin/series', '/admin/series/[id]'],
  actions: ['video.edit', 'series.manage'],
  covers: { nav: ['Series'] },
  dependsOn: [
    'apps/web/src/components/admin/VideosList.tsx',
    'apps/web/src/components/admin/SeriesEditor.tsx',
  ],
  next: 'K03 Let visitors watch without an account',
  steps: [
    {
      caption: 'Choose **Videos** in the side menu.',
      run: async (s) => {
        await goToScreen(s, 'Videos');
        await s.page.getByRole('heading', { name: 'Videos' }).first().waitFor();
      },
    },
    {
      caption: 'Select **Life Skills** from **Category**.',
      run: async (s) => {
        const list = s.page.getByRole('main').getByLabel('Category', { exact: true }).first();
        await s.click(list);
        await list.selectOption({ label: 'Life Skills' });
        await s.page.getByLabel('Select Staying Safe Online').first().waitFor();
        await s.pause(800);
      },
    },
    {
      caption: 'Tick **Select Counting Money in Naira**.',
      run: async (s) => {
        const box = s.page.getByLabel('Select Counting Money in Naira').first();
        await s.reveal(box, 0.4);
        await s.click(box);
      },
    },
    {
      caption: 'Tick **Select Staying Safe Online**.',
      run: async (s) => {
        const box = s.page.getByLabel('Select Staying Safe Online').first();
        await s.click(box);
      },
      shot: {
        name: 'two-selected',
        alt: 'Two videos ticked in the Videos list, marked 1 and 2',
        marks: [
          { target: (s) => s.page.getByLabel('Select Counting Money in Naira').first(), label: 'First video' },
          { target: (s) => s.page.getByLabel('Select Staying Safe Online').first(), label: 'Second video' },
        ],
      },
    },
    {
      caption: 'Click **Set maturity rating**.',
      run: async (s) => {
        await s.click(s.page.getByRole('button', { name: 'Set maturity rating' }).first());
        await s.page.getByRole('dialog').waitFor();
        await settle(s, 500);
      },
    },
    {
      caption: 'Select **PG** from **Maturity rating**.',
      note: 'Every ticked video gets this rating. The change is all or nothing.',
      run: async (s) => {
        const list = s.page.getByRole('dialog').getByLabel('Maturity rating');
        await s.click(list);
        await list.selectOption({ label: 'PG' });
        await s.pause(600);
      },
      shot: {
        name: 'bulk-rating',
        alt: 'The Set maturity rating box with PG chosen, marked 1',
        marks: [{ target: (s) => s.page.getByRole('dialog').getByLabel('Maturity rating'), label: 'Rating' }],
      },
    },
    {
      caption: 'Click **Apply**.',
      note: 'A message with Undo appears for a few seconds. Use it if you chose the wrong rating.',
      run: async (s) => {
        await s.click(s.page.getByRole('dialog').getByRole('button', { name: 'Apply' }));
        await settle(s, 1500);
      },
    },
    {
      caption: 'Choose **Series** in the side menu.',
      run: async (s) => {
        await goToScreen(s, 'Series');
        await s.page.getByRole('heading', { name: 'Series' }).first().waitFor();
      },
    },
    {
      caption: 'Click **Maths Made Simple** to open the series.',
      run: async (s) => {
        await s.click(s.page.getByRole('link', { name: 'Maths Made Simple' }).first());
        await s.page.getByRole('heading', { name: 'Details' }).waitFor();
        await settle(s);
      },
    },
    {
      caption: 'Select **G** from **Maturity rating (required)**.',
      run: async (s) => {
        const list = s.page.getByLabel('Maturity rating (required)');
        await s.click(list);
        await list.selectOption({ label: 'G' });
        await s.pause(600);
      },
      shot: {
        name: 'series-rating',
        alt: 'The series Maturity rating list set to G, marked 1',
        marks: [{ target: (s) => s.page.getByLabel('Maturity rating (required)'), label: 'Series rating' }],
      },
    },
    {
      caption: 'Click **Save changes**.',
      run: async (s) => {
        await s.click(s.page.getByRole('button', { name: 'Save changes' }));
        await s.page.getByText('Series saved.').first().waitFor();
        await settle(s, 800);
      },
    },
    {
      caption: 'Click **Apply to all 2 episodes**.',
      note: 'Episodes keep their own rating unless you do this step.',
      run: async (s) => {
        await s.click(s.page.getByRole('button', { name: /^Apply to all/ }));
        await s.page.getByRole('dialog').waitFor();
        await settle(s, 500);
      },
    },
    {
      caption: 'Click **Apply to 2 episodes**.',
      run: async (s) => {
        await s.click(s.page.getByRole('dialog').getByRole('button', { name: /^Apply to/ }));
        await s.page.getByText('Rating applied to every episode.').first().waitFor();
        await settle(s, 1000);
      },
    },
  ],
};

export default episode;
