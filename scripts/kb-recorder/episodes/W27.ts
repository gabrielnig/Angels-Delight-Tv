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
  viewports: ['desktop', 'mobile'],
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
      caption: 'Click **Preview site** in the top bar.',
      run: async (s) => {
        // The real link opens a new tab; the recording stays in one tab, so it goes to the same viewer page.
        await s.goto('/series/everyday-science');
        await s.page.getByRole('heading', { level: 1 }).first().waitFor();
      },
      shot: {
        name: 'series-page',
        alt: 'The viewer series page with its group list and lessons, marked 1',
        marks: [
          {
            target: (s) => s.page.getByRole('heading', { level: 1 }).first(),
            label: 'Series page',
          },
        ],
      },
    },
    {
      caption: 'Check that **Play** starts the first lesson.',
      run: async (s) => {
        await highlight(s, s.page.getByRole('link', { name: /^Play|^Resume/ }).first());
      },
    },
  ],
};
export default episode;
