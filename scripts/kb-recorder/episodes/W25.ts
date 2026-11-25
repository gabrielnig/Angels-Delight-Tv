import type { Episode } from '../episode';
import { clickByName, goToScreen, waitForToast } from '../helpers';

const DUP = 'Demo lesson: Proverbs 15, a gentle answer';

/** The Proverbs demo series has a gap (no lesson 2) and a duplicate (two lesson 3). Fix it with one number. */
const episode: Episode = {
  id: 'W25',
  title: 'Fix gaps and duplicate numbers',
  role: 'editor',
  screens: ['/admin/series/[id]'],
  actions: ['series.manage'],
  dependsOn: [
    'apps/web/src/components/admin/SeriesEditor.tsx',
    'apps/web/src/lib/series-bundle.ts',
  ],
  next: 'W26 Set a series maturity rating and apply it to every lesson',
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
      caption: 'Check that **Check the numbers** warns about the problem.',
      run: async (s) => {
        await s.page.getByText('Check the numbers').first().waitFor();
        await s.point(s.page.getByText('Check the numbers').first());
        await s.pause(1500);
      },
      shot: {
        name: 'warning',
        alt: 'The Check the numbers warning listing a missing lesson and a repeated lesson, marked 1',
        marks: [{ target: (s) => s.page.getByText('Check the numbers').first(), label: 'Warning' }],
      },
    },
    {
      caption: 'Type "2" in the **Lesson** box.',
      run: async (s) => {
        const row = s.page.getByRole('listitem').filter({ hasText: DUP }).last();
        const box = row.getByLabel('Lesson');
        await box.fill('');
        await s.type(box, '2');
      },
    },
    {
      caption: `Click **Save numbers for ${DUP}**.`,
      run: async (s) => {
        await clickByName(s, 'button', `Save numbers for ${DUP}`);
        await waitForToast(s, 'Numbers saved.');
      },
    },
  ],
};
export default episode;
