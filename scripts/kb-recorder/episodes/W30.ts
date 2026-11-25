import type { Episode } from '../episode';
import { clickByName, goToScreen, selectOption, typeInto } from '../helpers';

/** Select the Joseph lessons, then add them to a category with the bulk bar. */
const episode: Episode = {
  id: 'W30',
  title: 'Change many videos at once',
  role: 'editor',
  screens: ['/admin/videos'],
  actions: ['video.edit'],
  dependsOn: ['apps/web/src/components/admin/VideosList.tsx', 'apps/web/src/components/admin/bulk'],
  next: 'W31 Approve many captions at once',
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
        await s.type(s.page.getByRole('searchbox', { name: 'Search', exact: true }), 'Joseph');
        await s.page.getByRole('row').filter({ hasText: 'Demo lesson: Joseph is sold' }).first().waitFor();
      },
    },
    {
      caption: 'Tick **Select all on this page**.',
      run: async (s) => {
        await s.click(s.page.getByLabel('Select all on this page').first());
      },
      shot: {
        name: 'bar',
        alt: 'The bulk bar with Publish, Add to category and Set maturity rating, marked 1',
        marks: [
          {
            target: (s) => s.page.getByRole('button', { name: 'Add to category' }),
            label: 'Add to category',
          },
        ],
      },
    },
    {
      caption: 'Click **Add to category** in the bar.',
      run: async (s) => {
        await clickByName(s, 'button', 'Add to category');
        await s.page.getByRole('dialog').waitFor();
      },
    },
    {
      caption: 'Select **Life Skills** from the **Category** list.',
      run: async (s) => {
        await selectOption(s, 'Category', 'Life Skills');
      },
    },
    {
      caption: 'Click **Apply** in the box.',
      run: async (s) => {
        await s.click(s.page.getByRole('dialog').getByRole('button', { name: 'Apply' }));
        await s.pause(1200);
      },
    },
  ],
};
export default episode;
