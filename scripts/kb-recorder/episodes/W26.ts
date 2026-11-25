import type { Episode } from '../episode';
import { clickByName, goToScreen, waitForToast } from '../helpers';

/** Apply the series maturity rating to every lesson (the Genesis demo series is already rated). */
const episode: Episode = {
  id: 'W26',
  title: 'Set a series maturity rating and apply it to every lesson',
  role: 'editor',
  screens: ['/admin/series/[id]'],
  actions: ['series.manage'],
  dependsOn: ['apps/web/src/components/admin/SeriesEditor.tsx'],
  next: 'W27 See how a series looks to viewers',
  steps: [
    {
      caption: 'Choose **Series** in the side menu.',
      run: async (s) => {
        await goToScreen(s, 'Series');
      },
    },
    {
      caption: 'Click **Demo series: Genesis** in the list.',
      run: async (s) => {
        await clickByName(s, 'link', 'Demo series: Genesis');
        await s.page.getByRole('heading', { name: 'Details' }).waitFor();
      },
    },
    {
      caption: 'Check that **Maturity rating (required)** shows a rating.',
      run: async (s) => {
        await s.point(s.page.getByLabel('Maturity rating (required)'));
        await s.pause(1200);
      },
      shot: {
        name: 'rating',
        alt: 'The Maturity rating list with a rating chosen, marked 1',
        marks: [
          { target: (s) => s.page.getByLabel('Maturity rating (required)'), label: 'Rating' },
        ],
      },
    },
    {
      caption: 'Click **Apply to all 5 lessons**.',
      run: async (s) => {
        await s.click(s.page.getByRole('button', { name: /^Apply to all/ }));
        await s.page.getByRole('dialog').waitFor();
      },
      shot: {
        name: 'apply',
        alt: 'The box asking to apply the rating to every lesson, marked 1',
        crop: (s) => s.page.getByRole('dialog'),
        marks: [
          {
            target: (s) => s.page.getByRole('dialog').getByRole('button', { name: /^Apply to/ }),
            label: 'Apply',
          },
        ],
      },
    },
    {
      caption: 'Click **Apply to 5 lessons** to confirm.',
      run: async (s) => {
        await s.click(s.page.getByRole('dialog').getByRole('button', { name: /^Apply to \d/ }));
        await waitForToast(s, 'Rating applied to every lesson.');
      },
    },
  ],
};
export default episode;
