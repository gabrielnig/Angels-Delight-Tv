import type { Episode } from '../episode';
import { clickByName, goToScreen, waitForToast } from '../helpers';

const MOVER = 'Demo lesson: Genesis 22, Abraham and Isaac';

/** Rename a group, then move a lesson into another group by changing its group and lesson numbers. */
const episode: Episode = {
  id: 'W24',
  title: 'Move a lesson to another group and rename groups',
  role: 'editor',
  screens: ['/admin/series/[id]'],
  actions: ['series.manage'],
  dependsOn: ['apps/web/src/components/admin/SeriesEditor.tsx'],
  next: 'W25 Fix gaps and duplicate numbers',
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
        await s.page.getByRole('heading', { name: 'Lessons' }).waitFor();
      },
    },
    {
      caption: 'Type "Creation" in the **Title for Part 1** box.',
      run: async (s) => {
        const box = s.page.getByLabel('Title for Part 1', { exact: true });
        await box.fill('');
        await s.type(box, 'Creation');
      },
    },
    {
      caption: 'Click **Save title for Part 1**.',
      run: async (s) => {
        await clickByName(s, 'button', 'Save title for Part 1');
        await waitForToast(s, 'Title saved.');
      },
      shot: {
        name: 'renamed',
        alt: 'The Part 1 heading now reading Creation, with its Save title button marked 1',
        marks: [
          {
            target: (s) => s.page.getByRole('button', { name: 'Save title for Part 1' }),
            label: 'Save title',
          },
        ],
      },
    },
    {
      caption: 'Type "1" in the **Part** box.',
      run: async (s) => {
        const row = s.page.getByRole('listitem').filter({ hasText: MOVER }).last();
        const box = row.getByLabel('Part', { exact: true });
        await box.fill('');
        await s.type(box, '1');
      },
    },
    {
      caption: 'Type "4" in the **Lesson** box.',
      run: async (s) => {
        const row = s.page.getByRole('listitem').filter({ hasText: MOVER }).last();
        const box = row.getByLabel('Lesson', { exact: true });
        await box.fill('');
        await s.type(box, '4');
      },
    },
    {
      caption: `Click **Save numbers for ${MOVER}**.`,
      run: async (s) => {
        await clickByName(s, 'button', `Save numbers for ${MOVER}`);
        await waitForToast(s, 'Numbers saved.');
      },
    },
  ],
};
export default episode;
