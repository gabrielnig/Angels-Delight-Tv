import type { Episode } from '../episode';
import { clickByName, goToScreen, waitForToast } from '../helpers';

/** Delete the Proverbs demo series. The videos stay in the library. */
const episode: Episode = {
  id: 'W28',
  title: 'Remove a series without losing videos',
  role: 'admin',
  screens: ['/admin/series/[id]'],
  actions: ['series.delete'],
  dependsOn: ['apps/web/src/components/admin/SeriesEditor.tsx'],
  next: 'W03 Manage categories',
  steps: [
    {
      caption: 'Choose **Series** in the side menu.',
      run: async (s) => {
        await goToScreen(s, 'Series');
      },
    },
    {
      caption: 'Click **Demo series: Proverbs** in the list.',
      run: async (s) => {
        await clickByName(s, 'link', 'Demo series: Proverbs');
        await s.page.getByRole('heading', { name: 'Lessons' }).waitFor();
      },
    },
    {
      caption: 'Click **Delete series** at the bottom of the page.',
      run: async (s) => {
        await clickByName(s, 'button', 'Delete series');
        await s.page.getByRole('dialog').waitFor();
      },
      shot: {
        name: 'confirm',
        alt: 'The box explaining that the lessons stay in the library, marked 1',
        crop: (s) => s.page.getByRole('dialog'),
        marks: [
          {
            target: (s) =>
              s.page.getByRole('dialog').getByRole('button', { name: 'Delete series' }),
            label: 'Confirm',
          },
        ],
      },
    },
    {
      caption: 'Click **Delete series** in the box to confirm.',
      run: async (s) => {
        await s.click(s.page.getByRole('dialog').getByRole('button', { name: 'Delete series' }));
        await waitForToast(s, 'Series deleted.');
      },
    },
  ],
};
export default episode;
