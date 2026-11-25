import type { Episode } from '../episode';
import { goToScreen, highlight } from '../helpers';

/** Harness proof episode: open the Videos list from the side menu and point at a video. */
const episode: Episode = {
  id: 'H02-videos-list',
  title: 'Open the Videos list',
  role: 'editor',
  screens: ['/admin/videos'],
  covers: { nav: ['Videos'] },
  dependsOn: ['apps/web/src/app/admin/videos/page.tsx', 'apps/web/src/components/admin/nav.ts'],
  viewports: ['desktop', 'mobile'],
  steps: [
    {
      caption: 'Choose Videos in the side menu.',
      run: async (s) => {
        await goToScreen(s, 'Videos');
        await s.page.getByRole('heading', { name: 'Videos' }).first().waitFor();
      },
      shot: {
        name: 'videos-list',
        alt: 'The Videos list with a video title marked 1',
        marks: [
          {
            target: (s) => s.page.getByRole('link', { name: 'Staying Safe Online' }).first(),
            label: 'A video',
          },
        ],
      },
    },
    {
      caption: 'Each row is one video with its status.',
      run: async (s) => {
        await highlight(s, s.page.getByRole('link', { name: 'Staying Safe Online' }).first());
      },
    },
  ],
};

export default episode;
