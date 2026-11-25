import type { Episode } from '../episode';
import { clickByName, goToScreen, highlight, markLabel, padSteps, typeInto, waitForToast } from '../c3-helpers';

const episode: Episode = {
  id: 'W04',
  title: 'Arrange the Home rows',
  role: 'editor',
  screens: ['/admin/home'],
  actions: ['home.curate'],
  covers: { nav: ['Home curation'] },
  dependsOn: ['apps/web/src/components/admin/HomeCuration.tsx', 'apps/web/src/components/admin/HomeSections.tsx', 'apps/web/src/components/admin/SectionEditor.tsx', 'apps/web/src/lib/data/admin/home-rules.ts'],
  next: 'W05 Choose hero banners and preview clips',
  steps: padSteps([
    {
      caption: 'Click **Home curation** in the side menu.',
      run: async (s) => {
        await goToScreen(s, 'Home curation');
        await s.page.getByRole('heading', { name: 'Home curation' }).first().waitFor();
      },
    },
    {
      caption: 'Check the **Sections** list.',
      note: 'Each section is one row on the viewer Home page, in the order viewers see them.',
      run: async (s) => highlight(s, s.page.getByRole('heading', { name: 'Sections' }), 1800),
      shot: {
        name: 'sections',
        alt: 'The Sections list with the Add section button marked 1',
        marks: [{ target: (s) => s.page.getByRole('button', { name: 'Add section', exact: true }), label: 'Add section' }],
      },
    },
    {
      caption: 'Click **Add section**.',
      run: async (s) => { await clickByName(s, 'button', 'Add section', { first: true }); await s.page.getByRole('dialog').waitFor(); },
    },
    {
      caption: 'Check the **What kind of section?** list and pick one.',
      note: 'Kinds include New, Popular, Trending now, Top 10, Most liked, Category, Series and a Manual list you fill by hand. Trending, Top 10 and Most liked stay hidden until enough viewers have watched.',
      run: async (s) => {
        await highlight(s, s.page.getByText('What kind of section?').first(), 1200);
        await s.click(s.page.getByRole('radio', { name: /^Most liked/ }));
      },
      shot: {
        name: 'kinds',
        alt: 'The Add a section box with the kinds list marked 1',
        marks: [{ target: (s) => s.page.getByRole('group', { name: 'What kind of section?' }), label: 'Kinds of section' }],
      },
    },
    {
      caption: 'Click **Add section** to confirm.',
      run: async (s) => { await s.click(s.page.getByRole('dialog').getByRole('button', { name: 'Add section', exact: true })); await s.page.getByText('Edit section:').first().waitFor(); },
    },
    {
      caption: 'Check the **View all link** choices.',
      note: 'Automatic opens the matching list page. Custom link uses a path or an https link. None hides the link.',
      run: async (s) => highlight(s, s.page.getByText('View all link', { exact: true }).first(), 2200),
      shot: {
        name: 'view-all',
        alt: 'The section editor with the View all link choices marked 1',
        marks: [{ target: (s) => s.page.getByText('View all link', { exact: true }).first(), label: 'View all link' }],
      },
    },
    {
      caption: 'Untick **Show My List**.',
      note: 'A hidden section stays in the list but viewers do not see it. Kids profiles have their own switch in the section editor.',
      run: async (s) => { await clickByName(s, 'switch', 'Show My List'); },
    },
    {
      caption: 'Click **Mobile** in the live preview.',
      run: async (s) => { await clickByName(s, 'button', 'Mobile', { exact: true }); },
    },
    {
      caption: 'Click **Save draft**.',
      run: async (s) => { await clickByName(s, 'button', 'Save draft'); await waitForToast(s, 'Draft saved.'); },
    },
    {
      caption: 'Click **Publish changes**.',
      note: 'Viewers see the new order within a minute. Use Restore previous to undo the last publish.',
      run: async (s) => { await clickByName(s, 'button', 'Publish changes'); await waitForToast(s, 'Home page published.'); },
    },
  ]),
};
export default episode;
