import type { Episode } from '../episode';
import { clickByName, goToScreen, typeInto, waitForToast } from '../helpers';

/** Add a category, move it up and hide it. */
const episode: Episode = {
  id: 'W03',
  title: 'Manage categories',
  role: 'editor',
  screens: ['/admin/categories'],
  actions: ['category.manage'],
  covers: { nav: ['Categories'] },
  dependsOn: ['apps/web/src/components/admin/CategoriesManager.tsx'],
  next: 'W29 Organise your library with categories and tags',
  steps: [
    {
      caption: 'Choose **Categories** in the side menu.',
      run: async (s) => {
        await goToScreen(s, 'Categories');
      },
    },
    {
      caption: 'Click **Add category**.',
      run: async (s) => {
        await clickByName(s, 'button', 'Add category');
        await s.page.getByRole('dialog').waitFor();
      },
    },
    {
      caption: 'Type "Bible Teaching" in the **Name** box.',
      run: async (s) => {
        await typeInto(s, 'Name', 'Bible Teaching');
      },
    },
    {
      caption: 'Click **Save** in the box.',
      run: async (s) => {
        await s.click(s.page.getByRole('dialog').getByRole('button', { name: 'Save' }));
        await waitForToast(s, 'Category added.');
      },
      shot: {
        name: 'added',
        alt: 'The category list with Bible Teaching added at the bottom, marked 1',
        marks: [
          {
            target: (s) => s.page.getByRole('button', { name: 'Move Bible Teaching up' }),
            label: 'Up',
          },
        ],
      },
    },
    {
      caption: 'Click **Move Bible Teaching up**.',
      run: async (s) => {
        await clickByName(s, 'button', 'Move Bible Teaching up');
        await s.pause(800);
      },
    },
    {
      caption: 'Click **Hide Bible Teaching**.',
      run: async (s) => {
        await clickByName(s, 'button', 'Hide Bible Teaching');
        await s.pause(800);
      },
    },
  ],
};
export default episode;
