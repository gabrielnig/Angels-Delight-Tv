import type { Episode } from '../episode';
import { goToScreen, scrollTo } from '../helpers';

const episode: Episode = {
  id: 'W04',
  title: 'Arrange the Home rows',
  role: 'editor',
  screens: ['/admin/home'],
  actions: ['home.curate'],
  covers: {'nav': ['Home curation']},
  dependsOn: ['apps/web/src/app/admin/(shell)/home', 'apps/web/src/components/admin/HomeCuration.tsx'],
  next: 'W05 Choose hero banners and preview clips',
  steps: [
    {
      caption: 'Choose **Home curation** in the side menu.',
      note: 'Rows on Home are called sections.',
      holdMs: 2500,
      run: async (s) => {
        await goToScreen(s, 'Home curation');
        await s.page.getByRole('heading', { name: 'Home curation' }).first().waitFor();
      },
      shot: {
        name: 'home',
        alt: 'The Home curation page with the Sections list marked 1',
        marks: [{ target: (s) => s.page.getByRole('heading', { name: 'Sections' }), label: 'Sections' }],
      },
    },
    {
      caption: 'Click **Move New this week up**.',
      note: 'Each click moves a section one place. The preview on the right updates.',
      holdMs: 2500,
      run: async (s) => {
        await s.click(s.page.getByRole('button', { name: 'Move New this week up', exact: true }));
      },
      shot: {
        name: 'moved',
        alt: 'The sections list with Move up marked 1',
        marks: [{ target: (s) => s.page.getByRole('button', { name: 'Move New this week up', exact: true }), label: 'Move up' }],
      },
    },
    {
      caption: 'Click **Mobile**.',
      note: 'Check both sizes. Most viewers use a phone.',
      holdMs: 2500,
      run: async (s) => {
        await s.click(s.page.getByRole('tab', { name: 'Mobile', exact: true }));
      },
    },
    {
      caption: 'Click **Desktop**.',
      holdMs: 2500,
      run: async (s) => {
        await s.click(s.page.getByRole('tab', { name: 'Desktop', exact: true }));
      },
    },
    {
      caption: 'Click **Save draft**.',
      note: 'A draft is saved for you. Viewers do not see it yet.',
      holdMs: 2500,
      run: async (s) => {
        await s.click(s.page.getByRole('button', { name: 'Save draft', exact: true }));
      },
    },
    {
      caption: 'Click **Publish changes**.',
      note: 'If you do not like the result, use Restore previous to go back.',
      holdMs: 2500,
      run: async (s) => {
        await s.click(s.page.getByRole('button', { name: 'Publish changes', exact: true }));
        await s.pause(1000);
      },
      shot: {
        name: 'publish',
        alt: 'The Publish changes button marked 1',
        marks: [{ target: (s) => s.page.getByRole('button', { name: 'Publish changes' }), label: 'Publish changes' }],
      },
    },
  ],
};

export default episode;
