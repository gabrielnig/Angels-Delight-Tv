import type { Episode } from '../episode';
import { clickByName, goToScreen, selectOption, typeInto } from '../helpers';

const joseph = [
  'Demo lesson: Joseph is sold',
  'Demo lesson: Joseph in Egypt',
  'Demo lesson: Joseph forgives',
];

/** Bundle videos into a series from the Videos list with Add to series, the numbering preview and Undo. */
const episode: Episode = {
  id: 'W23',
  title: 'Add many videos to a series',
  role: 'editor',
  screens: ['/admin/videos'],
  actions: ['series.manage'],
  dependsOn: [
    'apps/web/src/components/admin/AddToSeriesDialog.tsx',
    'apps/web/src/components/admin/VideosList.tsx',
    'apps/web/src/lib/series-bundle.ts',
  ],
  next: 'W02 Reorder episodes and seasons',
  steps: [
    {
      caption: 'Choose **Videos** in the side menu.',
      run: async (s) => {
        await goToScreen(s, 'Videos');
      },
    },
    {
      caption: 'Type "Joseph" in the **Search** box.',
      run: async (s) => {
        await typeInto(s, 'Search', 'Joseph');
        await s.page.getByRole('row').filter({ hasText: joseph[0]! }).first().waitFor();
      },
    },
    {
      caption: 'Tick **Select all on this page**.',
      run: async (s) => {
        await s.click(s.page.getByLabel('Select all on this page').first());
      },
      shot: {
        name: 'selected',
        alt: 'Three Joseph lessons ticked, with the bulk bar showing how many are selected, marked 1',
        marks: [
          {
            target: (s) => s.page.getByRole('button', { name: 'Add to series' }),
            label: 'Add to series',
          },
        ],
      },
    },
    {
      caption: 'Click **Add to series** in the bar.',
      run: async (s) => {
        await clickByName(s, 'button', 'Add to series');
        await s.page.getByRole('dialog').waitFor();
      },
    },
    {
      caption: 'Select **Demo series: Genesis** from the **Series** list.',
      run: async (s) => {
        await selectOption(s, 'Series', 'Demo series: Genesis');
      },
    },
    {
      caption: 'Type "3" in the **Part** box.',
      run: async (s) => {
        await typeInto(s, 'Part', '3');
        await s.page.getByRole('table', { name: 'Preview' }).waitFor();
      },
      shot: {
        name: 'preview',
        alt: 'The preview table listing each video with its Part and Lesson, marked 1',
        crop: (s) => s.page.getByRole('dialog'),
        marks: [
          { target: (s) => s.page.getByRole('table', { name: 'Preview' }), label: 'Preview' },
        ],
      },
    },
    {
      caption: 'Click **Add 3 videos**.',
      run: async (s) => {
        await clickByName(s, 'button', 'Add 3 videos');
        await s.page.getByRole('status').filter({ hasText: 'Undo' }).first().waitFor();
      },
    },
    {
      caption: 'Click **Undo** to take them out again.',
      run: async (s) => {
        await clickByName(s, 'button', 'Undo');
        await s.pause(800);
      },
    },
  ],
};
export default episode;
