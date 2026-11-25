import type { Episode } from '../episode';
import { goToScreen, highlight } from '../helpers';

/** S01 Welcome: a tour of what the admin is for, one side menu item at a time. */
const episode: Episode = {
  id: 'S01',
  title: 'Welcome: what this platform does and what you can do',
  role: 'editor',
  screens: ['/admin'],
  actions: ['admin.access'],
  covers: { nav: ['Dashboard'] },
  dependsOn: ['apps/web/src/components/admin/nav.ts', 'apps/web/src/components/admin/DashboardView.tsx'],
  next: 'S02 Sign in and set up two step sign in',
  steps: [
    {
      caption: 'Check that the **Dashboard** is open. It is your home in the admin.',
      holdMs: 2200,
      run: async (s) => {
        await highlight(s, s.page.getByRole('heading', { name: 'Dashboard' }), 1500);
      },
      shot: {
        name: 'dashboard',
        alt: 'The Dashboard with its heading marked 1',
        marks: [
          { target: (s) => s.page.getByRole('heading', { name: 'Dashboard' }), label: 'Dashboard' },
        ],
      },
    },
    {
      caption: 'Choose **Videos** in the side menu to see every video you have added.',
      holdMs: 2200,
      run: async (s) => {
        await goToScreen(s, 'Videos');
        await s.page.getByRole('heading', { name: 'Videos' }).first().waitFor();
      },
      shot: {
        name: 'videos',
        alt: 'The Videos list with the side menu item marked 1',
        marks: [{ target: (s) => s.page.getByRole('link', { name: 'Videos', exact: true }).first(), label: 'Videos' }],
      },
    },
    {
      caption: 'Choose **Upload** in the side menu to add a new video.',
      holdMs: 2200,
      run: async (s) => {
        await goToScreen(s, 'Upload');
        await s.page.getByRole('heading', { name: 'Upload videos' }).first().waitFor();
      },
      shot: {
        name: 'upload',
        alt: 'The Upload page with the drop box marked 1',
        marks: [{ target: (s) => s.page.getByRole('button', { name: 'Choose videos' }), label: 'Choose videos' }],
      },
    },
    {
      caption: 'Choose **Encoding** in the side menu to watch videos get ready.',
      holdMs: 2200,
      run: async (s) => {
        await goToScreen(s, 'Encoding');
        await s.page.getByRole('heading', { name: 'Encoding' }).first().waitFor();
      },
      shot: {
        name: 'encoding',
        alt: 'The Encoding queue with its heading marked 1',
        marks: [{ target: (s) => s.page.getByRole('heading', { name: 'Encoding' }).first(), label: 'Encoding' }],
      },
    },
    {
      caption: 'Choose **Captions** in the side menu to check the words on screen.',
      holdMs: 2200,
      run: async (s) => {
        await goToScreen(s, 'Captions');
        await s.page.getByRole('heading', { name: 'Captions' }).first().waitFor();
      },
      shot: {
        name: 'captions',
        alt: 'The Captions list with its heading marked 1',
        marks: [{ target: (s) => s.page.getByRole('heading', { name: 'Captions' }).first(), label: 'Captions' }],
      },
    },
    {
      caption: 'Choose **Home curation** in the side menu to arrange the Home page.',
      holdMs: 2200,
      run: async (s) => {
        await goToScreen(s, 'Home curation');
        await s.page.getByRole('heading', { name: 'Home curation' }).first().waitFor();
      },
      shot: {
        name: 'home',
        alt: 'The Home curation screen with its heading marked 1',
        marks: [{ target: (s) => s.page.getByRole('heading', { name: 'Home curation' }).first(), label: 'Home curation' }],
      },
    },
    {
      caption: 'Choose **Analytics** in the side menu to read your numbers.',
      holdMs: 2200,
      run: async (s) => {
        await goToScreen(s, 'Analytics');
        await s.page.getByRole('heading', { name: 'Analytics' }).first().waitFor();
      },
      shot: {
        name: 'analytics',
        alt: 'The Analytics screen with its heading marked 1',
        marks: [{ target: (s) => s.page.getByRole('heading', { name: 'Analytics' }).first(), label: 'Analytics' }],
      },
    },
    {
      caption: 'Choose **Help centre** in the side menu when you need a guide.',
      holdMs: 2200,
      run: async (s) => {
        await goToScreen(s, 'Help centre');
        await s.page.getByRole('heading', { name: 'Help centre' }).first().waitFor();
      },
      shot: {
        name: 'help',
        alt: 'The Help centre home with its heading marked 1',
        marks: [{ target: (s) => s.page.getByRole('heading', { name: 'Help centre' }).first(), label: 'Help centre' }],
      },
    },
    {
      caption: 'Choose **Dashboard** in the side menu to come back home.',
      holdMs: 2200,
      run: async (s) => {
        await goToScreen(s, 'Dashboard');
        await s.page.getByRole('heading', { name: 'Dashboard' }).first().waitFor();
      },
    },
  ],
};

export default episode;
