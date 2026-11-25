import type { Episode } from '../episode';
import { highlight, waitForToast } from '../helpers';
import { menuTo, slow } from '../helpers-c7';

/** T13: a row is not showing on Home. Draft versus published, the visible switch, kids view. */
const episode: Episode = {
  id: 'T13',
  title: 'A row is not showing on Home',
  role: 'editor',
  screens: ['/admin/home'],
  actions: ['home.curate'],
  covers: { nav: ['Home curation'] },
  dependsOn: [
    'apps/web/src/components/admin/HomeCuration.tsx',
    'apps/web/src/components/admin/HomeSections.tsx',
    'apps/web/src/components/admin/SectionEditor.tsx',
  ],
  steps: [
    {
      caption: 'Choose **Home curation** in the side menu.',
      run: async (s) => {
        await menuTo(s, 'Home curation');
        await s.page.getByRole('heading', { name: 'Home curation' }).first().waitFor();
      },
    },
    {
      caption: 'Check the **Draft** line beside the buttons.',
      note: 'It says Published and up to date, Saved draft not published, or Unsaved changes. Viewers only see what is published.',
      run: async (s) => {
        await highlight(s, s.page.getByRole('status').filter({ hasText: /Published|draft|Unsaved/ }).first());
      },
      shot: {
        name: 'status',
        alt: 'The Home curation toolbar with the publish status line marked 1',
        marks: [
          {
            target: (s) => s.page.getByRole('status').filter({ hasText: /Published|draft|Unsaved/ }).first(),
            label: 'Publish status',
          },
        ],
      },
    },
    {
      caption: 'Scroll to **Sections** for the row.',
      run: async (s) => {
        await highlight(s, s.page.getByText('New this week').first());
      },
    },
    {
      caption: 'Click the **Show New this week** switch.',
      note: 'A section that is switched off says Hidden and viewers do not see it.',
      run: async (s) => {
        await s.click(s.page.getByRole('switch', { name: 'Show New this week' }));
      },
      shot: {
        name: 'hidden',
        alt: 'A section switch showing Hidden, marked 1',
        marks: [
          { target: (s) => s.page.getByRole('switch', { name: 'Show New this week' }), label: 'Visible or Hidden' },
        ],
      },
    },
    {
      caption: 'Click **Show New this week** again to show it.',
      run: async (s) => {
        await s.click(s.page.getByRole('switch', { name: 'Show New this week' }));
      },
    },
    {
      caption: 'Click **Kids view** in the live preview.',
      note: 'Kids profiles only see sections marked for kids, and only kid safe videos in them.',
      run: async (s) => {
        await s.click(s.page.getByRole('switch', { name: 'Kids view' }));
      },
    },
    {
      caption: 'Click **Move New this week down**.',
      note: 'Any change to Home, such as a new order, is kept as a draft until you publish it.',
      run: async (s) => {
        await s.click(s.page.getByRole('button', { name: 'Move New this week down' }));
        await s.page.getByText('Unsaved changes').first().waitFor();
      },
    },
    {
      caption: 'Click **Save draft**.',
      run: async (s) => {
        await s.click(s.page.getByRole('button', { name: 'Save draft' }));
        await waitForToast(s, /Draft saved/);
      },
    },
    {
      caption: 'Click **Publish changes**.',
      run: async (s) => {
        await s.click(s.page.getByRole('button', { name: 'Publish changes' }));
        await waitForToast(s, /Home page published/);
      },
    },
  ],
};

export default slow(episode, 1500);
