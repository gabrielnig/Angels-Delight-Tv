import type { Episode } from '../episode';
import { clickByName, goToScreen, highlight, scrollTo } from '../helpers';

/** What a series is: groups and items, shown on the Genesis demo series (Part and Lesson). */
const episode: Episode = {
  id: 'W20',
  title: 'Plan a series: groups and items',
  role: 'editor',
  screens: ['/admin/series', '/admin/series/[id]'],
  covers: { nav: ['Series'] },
  dependsOn: [
    'apps/web/src/components/admin/SeriesList.tsx',
    'apps/web/src/components/admin/SeriesEditor.tsx',
    'apps/web/src/lib/data/admin/kb-demo',
  ],
  next: 'W01 Create a series and add episodes',
  steps: [
    {
      caption: 'Choose **Series** in the side menu.',
      run: async (s) => {
        await goToScreen(s, 'Series');
        await s.page.getByRole('heading', { name: 'Series' }).first().waitFor();
      },
      shot: {
        name: 'series-list',
        alt: 'The Series list with the Genesis series marked 1',
        marks: [
          {
            target: (s) => s.page.getByRole('link', { name: 'Demo series: Genesis' }),
            label: 'A series',
          },
        ],
      },
    },
    {
      caption: 'Click **Demo series: Genesis** in the list.',
      run: async (s) => {
        await clickByName(s, 'link', 'Demo series: Genesis');
        await s.page.getByRole('heading', { name: 'Lessons' }).waitFor();
      },
    },
    {
      caption: 'Scroll to **Part 1** to see the first group.',
      run: async (s) => {
        await scrollTo(s, s.page.getByRole('heading', { name: /^Part 1/ }));
        await highlight(s, s.page.getByRole('heading', { name: /^Part 1/ }));
      },
      shot: {
        name: 'group-one',
        alt: 'The Part 1 group marked 1, with its lessons listed below it',
        marks: [{ target: (s) => s.page.getByRole('heading', { name: /^Part 1/ }), label: 'A group' }],
      },
    },
    {
      caption: 'Scroll to **Part 2** to see the second group.',
      run: async (s) => {
        await scrollTo(s, s.page.getByRole('heading', { name: /^Part 2/ }));
        await highlight(s, s.page.getByRole('heading', { name: /^Part 2/ }));
      },
    },
  ],
};
export default episode;
