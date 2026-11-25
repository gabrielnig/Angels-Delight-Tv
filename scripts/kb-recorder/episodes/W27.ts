import type { Episode } from '../episode';
import { clickByName, goToScreen, highlight } from '../helpers';

/**
 * How a series looks to viewers. The viewer fixtures hold the Everyday Science series (the admin demo series are not in
 * the viewer data), so the viewer steps show that series. Phone and desktop are both recorded.
 */
const episode: Episode = {
  id: 'W27',
  title: 'See how a series looks to viewers',
  role: 'editor',
  screens: ['/admin/series/[id]'],
  dependsOn: ['apps/web/src/app/(viewer)/series', 'apps/web/src/components/title'],
  next: 'W28 Remove a series without losing videos',
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
      caption: 'Check that **Published** is switched on.',
      run: async (s) => {
        await highlight(s, s.page.getByLabel('Published'));
      },
      shot: {
        name: 'published',
        alt: 'The Published switch marked 1 on the series page',
        marks: [{ target: (s) => s.page.getByLabel('Published'), label: 'Published' }],
      },
    },
  ],
};
export default episode;
