import type { Episode } from '../episode';
import { clickByName, goToScreen, scrollTo, waitForToast } from '../helpers';

/** Give one series its own names (series editor, Names for groups and items). */
const episode: Episode = {
  id: 'W22',
  title: 'Use different names for one series',
  role: 'editor',
  screens: ['/admin/series/[id]'],
  actions: ['series.manage'],
  dependsOn: ['apps/web/src/components/admin/SeriesEditor.tsx'],
  next: 'W23 Add many videos to a series',
  steps: [
    {
      caption: 'Choose **Series** in the side menu.',
      run: async (s) => {
        await goToScreen(s, 'Series');
      },
    },
    {
      caption: 'Click **Maths Made Simple** in the list.',
      run: async (s) => {
        await clickByName(s, 'link', 'Maths Made Simple');
        await s.page.getByRole('heading', { name: 'Details' }).waitFor();
      },
    },
    {
      caption: 'Scroll to **Names for groups and items**.',
      run: async (s) => {
        await scrollTo(s, s.page.getByRole('heading', { name: 'Names for groups and items' }));
      },
    },
    {
      caption: 'Click **Use names for this series only**.',
      run: async (s) => {
        await s.click(s.page.getByLabel('Use names for this series only'));
        await s.page.getByLabel('Name set').waitFor();
      },
      shot: {
        name: 'own-names',
        alt: 'The series names section with Use names for this series only chosen, marked 1',
        marks: [
          {
            target: (s) => s.page.getByLabel('Use names for this series only'),
            label: 'Own names',
          },
        ],
      },
    },
    {
      caption: 'Select **Module and Lesson** from the **Name set** list.',
      run: async (s) => {
        await s.page.getByLabel('Name set').selectOption({ label: 'Module and Lesson' });
        await s.pause(500);
      },
    },
    {
      caption: 'Click **Save names**.',
      run: async (s) => {
        await clickByName(s, 'button', 'Save names');
        await waitForToast(s, 'Series names saved.');
      },
    },
  ],
};
export default episode;
