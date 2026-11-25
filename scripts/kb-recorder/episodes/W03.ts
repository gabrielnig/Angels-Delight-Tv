import type { Episode } from '../episode';
import { goToScreen } from '../helpers';

const NAME = 'Demo Study Skills';

const episode: Episode = {
  id: 'W03',
  title: 'Manage categories',
  role: 'editor',
  screens: ['/admin/categories'],
  actions: ['category.manage'],
  covers: { nav: ['Categories'] },
  dependsOn: [
    'apps/web/src/app/admin/(shell)/categories',
    'apps/web/src/components/admin/CategoriesManager.tsx',
  ],
  next: 'W04 Arrange the Home rows',
  steps: [
    {
      caption: 'Choose **Categories** in the side menu.',
      note: 'The order here is the order viewers see on the home page.',
      holdMs: 2500,
      run: async (s) => {
        await goToScreen(s, 'Categories');
        await s.page.getByRole('heading', { name: 'Categories' }).first().waitFor();
      },
      shot: {
        name: 'list',
        alt: 'The Categories page with the Add category button marked 1',
        marks: [{ target: (s) => s.page.getByRole('button', { name: 'Add category' }), label: 'Add category' }],
      },
    },
    {
      caption: 'Click **Add category**.',
      holdMs: 2500,
      run: async (s) => {
        await s.click(s.page.getByRole('button', { name: 'Add category' }));
        await s.page.getByLabel('Name', { exact: true }).waitFor();
      },
    },
    {
      caption: `Type "${NAME}" in the **Name** box.`,
      note: 'Use up to 40 characters. Short names fit best on a phone.',
      holdMs: 2500,
      run: async (s) => {
        await s.type(s.page.getByLabel('Name', { exact: true }), NAME);
      },
      shot: {
        name: 'add',
        alt: 'The Add a category box with the Name field marked 1',
        marks: [{ target: (s) => s.page.getByLabel('Name', { exact: true }), label: 'Name' }],
      },
    },
    {
      caption: 'Click **Save**.',
      note: 'The new category goes to the end of the list.',
      holdMs: 2500,
      run: async (s) => {
        await s.click(s.page.getByRole('button', { name: 'Save', exact: true }));
        await s.page.getByRole('button', { name: `Rename ${NAME}` }).waitFor();
      },
    },
    {
      caption: `Click **Move ${NAME} up**.`,
      note: 'Each click moves it one place. Use Move down to go the other way.',
      holdMs: 2500,
      run: async (s) => {
        await s.click(s.page.getByRole('button', { name: `Move ${NAME} up` }));
        await s.pause(800);
      },
      shot: {
        name: 'moved',
        alt: 'The category list with the new category moved up and its Move up button marked 1',
        marks: [{ target: (s) => s.page.getByRole('button', { name: `Move ${NAME} up` }), label: 'Move up' }],
      },
    },
    {
      caption: `Click **Rename ${NAME}**.`,
      holdMs: 2500,
      run: async (s) => {
        await s.click(s.page.getByRole('button', { name: `Rename ${NAME}` }));
        await s.page.getByLabel('Name', { exact: true }).waitFor();
      },
    },
    {
      caption: 'Type " Tips" in the **Name** box.',
      note: 'The old name is already in the box, so your words are added to the end.',
      holdMs: 2500,
      run: async (s) => {
        await s.type(s.page.getByLabel('Name', { exact: true }), ' Tips');
      },
    },
    {
      caption: 'Click **Save**.',
      holdMs: 2500,
      run: async (s) => {
        await s.click(s.page.getByRole('button', { name: 'Save', exact: true }));
        await s.page.getByRole('button', { name: `Rename ${NAME} Tips` }).waitFor();
      },
    },
    {
      caption: `Click **Hide ${NAME} Tips**.`,
      note: 'A hidden category stays here with a Hidden badge, but viewers no longer see it.',
      holdMs: 2500,
      run: async (s) => {
        await s.click(s.page.getByRole('button', { name: `Hide ${NAME} Tips` }));
        await s.page.getByRole('button', { name: `Show ${NAME} Tips` }).waitFor();
      },
      shot: {
        name: 'hidden',
        alt: 'The category with a Hidden badge, and its Show button marked 1',
        marks: [{ target: (s) => s.page.getByRole('button', { name: `Show ${NAME} Tips` }), label: 'Show' }],
      },
    },
    {
      caption: `Click **Delete ${NAME} Tips**.`,
      note: 'A category that still holds videos cannot be deleted. Hide it instead.',
      holdMs: 2500,
      run: async (s) => {
        await s.click(s.page.getByRole('button', { name: `Delete ${NAME} Tips` }));
        await s.page.getByRole('button', { name: 'Delete category' }).waitFor();
      },
    },
    {
      caption: 'Click **Delete category**.',
      note: 'This cannot be undone.',
      holdMs: 2500,
      run: async (s) => {
        await s.click(s.page.getByRole('button', { name: 'Delete category' }));
        await s.page.getByRole('button', { name: `Rename ${NAME} Tips` }).waitFor({ state: 'detached' });
      },
    },
  ],
};

export default episode;
