import type { Episode } from '../episode';
import { lookStep, navStep } from '../c1-common';
import { clickByName, typeInto } from '../helpers';

/** S05 Who can do what: find the roles guide in the help centre, which lists each task by role. */
const episode: Episode = {
  id: 'S05',
  title: 'Who can do what: Editor, Admin and Super admin',
  role: 'editor',
  actions: ['admin.access'],
  dependsOn: ['apps/web/src/lib/admin/can.ts', 'apps/web/src/components/admin/help', 'content/help/en/reference/R02-roles-and-permissions.md'],
  next: 'S06 Your first video from start to finish',
  steps: [
    navStep('Help centre', 'Choose **Help centre** in the side menu.', {
      shot: { name: 'help', alt: 'The Help centre home with the search box marked 1' },
    }),
    {
      caption: 'Type "roles" in the **Search the help centre** box.',
      holdMs: 1500,
      run: async (s) => {
        await typeInto(s, 'Search the help centre', 'roles');
      },
      shot: {
        name: 'search',
        alt: 'The search box with the word roles typed in, marked 1',
        marks: [{ target: (s) => s.page.getByLabel('Search the help centre', { exact: true }), label: 'Search' }],
      },
    },
    {
      caption: 'Click **Search**.',
      holdMs: 1500,
      run: async (s) => {
        await clickByName(s, 'button', 'Search', { exact: true });
        await s.page.getByRole('link', { name: 'Roles and permissions', exact: true }).waitFor();
      },
      shot: {
        name: 'results',
        alt: 'The search results with Roles and permissions marked 1',
        marks: [{ target: (s) => s.page.getByRole('link', { name: 'Roles and permissions', exact: true }), label: 'Roles and permissions' }],
      },
    },
    {
      caption: 'Click **Roles and permissions**.',
      holdMs: 1800,
      run: async (s) => {
        await clickByName(s, 'link', 'Roles and permissions', { exact: true });
        await s.page.getByRole('heading', { name: 'Roles and permissions' }).first().waitFor();
      },
    },
    lookStep(
      'Wait until you see **Who can do this**.',
      (s) => s.page.getByText('Who can do this').first(),
      { holdMs: 2800, shot: { name: 'guide', alt: 'The guide with its Who can do this line marked 1', label: 'Who can do this' } },
    ),
    lookStep(
      'Scroll to **Steps**.',
      (s) => s.page.getByRole('heading', { name: 'Steps', exact: true }),
      { holdMs: 3000, shot: { name: 'list', alt: 'The list of tasks and the lowest role for each, marked 1', label: 'Tasks by role' } },
    ),
    lookStep(
      'Scroll to **Related guides**.',
      (s) => s.page.getByRole('heading', { name: 'Related guides' }),
      { holdMs: 18800 },
    ),
  ],
};

export default episode;
