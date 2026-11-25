import type { Episode } from '../episode';
import { clickByName, goToScreen, highlight, padSteps, waitForToast } from '../c3-helpers';

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
      note: 'Each section is one row on the viewer Home page, in the order viewers see them. Add section starts a new row: you choose a kind (New, Popular, Trending now, Top 10, Most liked, Category, Series or Manual list) and a name. Trending now, Top 10 and Most liked stay hidden until enough viewers have watched.',
      run: async (s) => highlight(s, s.page.getByRole('heading', { name: 'Sections' }), 1800),
      shot: {
        name: 'sections',
        alt: 'The Sections list with the Add section button marked 1',
        marks: [{ target: (s) => s.page.getByRole('button', { name: 'Add section', exact: true }), label: 'Add section' }],
      },
    },
    {
      caption: 'Click **Edit New this week**.',
      run: async (s) => { await clickByName(s, 'button', 'Edit New this week'); await s.page.getByText('Edit section:').first().waitFor(); },
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
      caption: 'Click **Move New this week down**.',
      note: 'You can also drag the handle beside a section.',
      run: async (s) => { await clickByName(s, 'button', 'Move New this week down'); await s.pause(800); },
    },
    {
      caption: 'Untick **Show My List**.',
      note: 'A hidden section stays in the list but viewers do not see it. In the section editor, Show on Kids profiles has its own switch.',
      run: async (s) => { await clickByName(s, 'switch', 'Show My List'); },
    },
    {
      caption: 'Click **Mobile** in the live preview.',
      run: async (s) => { await clickByName(s, 'tab', 'Mobile', { exact: true }); await s.pause(600); },
      shot: {
        name: 'preview',
        alt: 'The live preview in phone size marked 1',
        marks: [{ target: (s) => s.page.getByRole('tab', { name: 'Mobile', exact: true }), label: 'Mobile' }],
      },
    },
    {
      caption: 'Click **Save draft**.',
      run: async (s) => { await clickByName(s, 'button', 'Save draft'); await waitForToast(s, 'Draft saved.'); },
    },
    {
      caption: 'Click **Publish changes**.',
      note: 'Viewers see the new order within a minute. Restore previous undoes the last publish and Restore launch defaults puts back the first layout.',
      run: async (s) => { await clickByName(s, 'button', 'Publish changes'); await waitForToast(s, 'Home page published.'); },
    },
  ]),
};
export default episode;
