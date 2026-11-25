import type { Episode } from '../episode';
import { highlight } from '../helpers';
import { menuTo, slow } from '../helpers-c7';

/** T14: a series is missing lessons. Check each lesson is published and the series itself is on. */
const episode: Episode = {
  id: 'T14',
  title: 'A series is missing lessons',
  role: 'editor',
  screens: ['/admin/series', '/admin/series/[id]'],
  actions: ['series.manage'],
  covers: { nav: ['Series'] },
  dependsOn: [
    'apps/web/src/components/admin/SeriesEditor.tsx',
    'apps/web/src/lib/data/admin/kb-demo/trouble.ts',
  ],
  steps: [
    {
      caption: 'Choose **Series** in the side menu.',
      run: async (s) => {
        await menuTo(s, 'Series');
        await s.page.getByRole('heading', { name: 'Series' }).first().waitFor();
      },
    },
    {
      caption: 'Click **Demo series: Small space gardening**.',
      run: async (s) => {
        await s.click(
          s.page
            .getByRole('main')
            .getByRole('link', { name: 'Demo series: Small space gardening', exact: true })
            .first(),
        );
        await s.page.getByText('Not published').first().waitFor();
      },
    },
    {
      caption: 'Scroll to **Not published** on one lesson.',
      note: 'Viewers only see lessons that are published. A lesson that is still a draft is in the list for you, not for them.',
      run: async (s) => {
        await s.reveal(s.page.getByText('Not published').first(), 0.3);
        await highlight(s, s.page.getByText('Not published').first());
      },
      shot: {
        name: 'lessons',
        alt: 'The lesson list with the lesson that is not published marked 1',
        marks: [{ target: (s) => s.page.getByText('Not published').first(), label: 'Not published' }],
      },
    },
    {
      caption: 'Check the **Published** switch for the whole series.',
      run: async (s) => {
        await s.reveal(s.page.getByRole('switch', { name: 'Published' }), 0.4);
        await highlight(s, s.page.getByRole('switch', { name: 'Published' }));
      },
    },
  ],
};

export default slow(episode, 5500);
