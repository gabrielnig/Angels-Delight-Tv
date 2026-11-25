import type { Episode } from '../episode';
import { goToScreen, scrollTo } from '../helpers';

const episode: Episode = {
  id: 'W05',
  title: 'Choose hero banners and preview clips',
  role: 'editor',
  screens: ['/admin/home'],
  actions: ['home.curate'],
  dependsOn: ['apps/web/src/app/admin/(shell)/home', 'apps/web/src/components/admin/HomeCuration.tsx'],
  next: 'W04 Arrange the Home rows',
  steps: [
    {
      caption: 'Choose **Home curation** in the side menu.',
      run: async (s) => {
        await goToScreen(s, 'Home curation');
        await s.page.getByRole('heading', { name: 'Home curation' }).first().waitFor();
      },
    },
    {
      caption: 'Scroll to **Hero titles**.',
      note: 'The hero is the big banner at the top of Home.',
      run: async (s) => {
        await scrollTo(s, s.page.getByRole('heading', { name: 'Hero titles' }));
      },
      shot: {
        name: 'hero',
        alt: 'The Hero titles area with the headline box marked 1',
        marks: [{ target: (s) => s.page.getByLabel('Headline for How to Save Money on Data'), label: 'Headline' }],
      },
    },
    {
      caption: 'Type " today" in the **Headline for How to Save Money on Data** box.',
      note: 'Keep it short. Viewers read it in a second.',
      run: async (s) => {
        await s.type(s.page.getByLabel('Headline for How to Save Money on Data', { exact: true }), ' today');
      },
    },
    {
      caption: 'Scroll to **Hero clips**.',
      note: 'A hero clip is a short silent preview. Choose Automatic, Pick a segment or Off on the video screen.',
      run: async (s) => {
        await scrollTo(s, s.page.getByRole('heading', { name: 'Hero clips' }));
      },
      shot: {
        name: 'clips',
        alt: 'The Hero clips area',
        marks: [{ target: (s) => s.page.getByRole('heading', { name: 'Hero clips' }), label: 'Hero clips' }],
      },
    },
    {
      caption: 'Click **Save draft**.',
      run: async (s) => {
        await s.click(s.page.getByRole('button', { name: 'Save draft', exact: true }));
      },
    },
  ],
};

export default episode;
