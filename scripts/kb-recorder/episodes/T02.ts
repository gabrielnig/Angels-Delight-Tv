import type { Episode } from '../episode';
import { clickByName, highlight } from '../helpers';
import { menuTo, slow } from '../helpers-c7';

/** T02: a video will not publish. Open Before you publish and follow Fix this. */
const episode: Episode = {
  id: 'T02',
  title: 'A video will not publish',
  role: 'editor',
  screens: ['/admin/videos/[id]'],
  actions: ['video.publish'],
  covers: { statuses: ['video:ready', 'publish:draft'] },
  dependsOn: [
    'apps/web/src/components/admin/VideoEditor.tsx',
    'apps/web/src/components/admin/ChecklistCard.tsx',
    'apps/web/src/lib/data/admin/video-rules.ts',
  ],
  steps: [
    {
      caption: 'Choose **Videos** in the side menu.',
      run: async (s) => {
        await menuTo(s, 'Videos');
        await s.page.getByRole('heading', { name: 'Videos' }).first().waitFor();
      },
    },
    {
      caption: 'Type "Naira" in the **Search** box.',
      run: async (s) => {
        await s.type(s.page.getByRole('main').getByLabel('Search'), 'Naira');
        await s.page.getByText('Counting Money in Naira').first().waitFor();
      },
    },
    {
      caption: 'Click **Edit Counting Money in Naira**.',
      run: async (s) => {
        await s.click(
          s.page
            .getByRole('main')
            .getByRole('link', { name: /Edit/ })
            .or(s.page.getByRole('main').getByRole('button', { name: /^Edit/ }))
            .first(),
        );
        await s.page.getByText('Before you publish').first().waitFor();
      },
    },
    {
      caption: 'Check the **Before you publish** list on the right.',
      run: async (s) => {
        await highlight(s, s.page.getByText('Before you publish').first());
      },
      shot: {
        name: 'checklist',
        alt: 'The Before you publish list with the open item marked 1',
        marks: [
          {
            target: (s) => s.page.getByText('Captions approved').first(),
            label: 'Needs attention',
          },
        ],
      },
    },
    {
      caption: 'Check the **Needs attention** items.',
      note: 'Each item says in plain words what is missing. The count shows how many are done.',
      run: async (s) => {
        await highlight(s, s.page.getByText('Choose a poster image.').first());
      },
    },
    {
      caption: 'Click **Fix this** under Poster.',
      run: async (s) => {
        await s.click(s.page.getByRole('link', { name: /Fix this.*Poster/ }).first());
        await s.page.waitForLoadState('networkidle').catch(() => {});
      },
      shot: {
        name: 'fix',
        alt: 'The screen that opens to fix the missing item',
        marks: [],
      },
    },
  ],
};

export default slow(episode, 1500);
