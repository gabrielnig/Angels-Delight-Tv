import type { Episode } from '../episode';
import { clickByName, goToScreen, selectOption, typeInto, waitForToast } from '../helpers';

/** Create a series and add its first video. A new series follows the site words (Season and Episode by default). */
const episode: Episode = {
  id: 'W01',
  title: 'Create a series and add episodes',
  role: 'editor',
  screens: ['/admin/series', '/admin/series/[id]'],
  actions: ['series.manage'],
  covers: { nav: ['Series'] },
  dependsOn: [
    'apps/web/src/components/admin/SeriesList.tsx',
    'apps/web/src/components/admin/SeriesEditor.tsx',
  ],
  next: 'W02 Reorder episodes and seasons',
  steps: [
    {
      caption: 'Choose **Series** in the side menu.',
      run: async (s) => {
        await goToScreen(s, 'Series');
      },
    },
    {
      caption: 'Click **New series**.',
      run: async (s) => {
        await clickByName(s, 'button', 'New series');
        await s.page.getByRole('dialog').waitFor();
      },
    },
    {
      caption: 'Type "Demo series: Joseph" in the **Title** box.',
      run: async (s) => {
        await typeInto(s, 'Title', 'Demo series: Joseph');
      },
    },
    {
      caption: 'Type "Demo lessons about Joseph." in the **Description** box.',
      run: async (s) => {
        await typeInto(s, 'Description', 'Demo lessons about Joseph.');
      },
      shot: {
        name: 'new-series',
        alt: 'The New series box with the title and description filled in, marked 1',
        crop: (s) => s.page.getByRole('dialog'),
        marks: [{ target: (s) => s.page.getByLabel('Title'), label: 'Title' }],
      },
    },
    {
      caption: 'Click **Create series**.',
      run: async (s) => {
        await clickByName(s, 'button', 'Create series');
        await waitForToast(s, 'Series created as a draft.');
      },
    },
    {
      caption: 'Click **Demo series: Joseph** in the list.',
      run: async (s) => {
        await clickByName(s, 'link', 'Demo series: Joseph');
        await s.page.getByRole('heading', { name: 'Details' }).waitFor();
      },
    },
    {
      caption: 'Select **Demo lesson: Joseph is sold** from the **Add a video** list.',
      run: async (s) => {
        await selectOption(s, 'Add a video', 'Demo lesson: Joseph is sold');
      },
      shot: {
        name: 'add-video',
        alt: 'The Add a video list with a Joseph lesson chosen, marked 1',
        marks: [{ target: (s) => s.page.getByLabel('Add a video'), label: 'Add a video' }],
      },
    },
    {
      caption: 'Click **Add episode** to put it in the series.',
      run: async (s) => {
        await clickByName(s, 'button', 'Add episode');
        await waitForToast(s, 'Episode added.');
      },
    },
  ],
};
export default episode;
