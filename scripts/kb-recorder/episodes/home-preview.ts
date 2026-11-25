import type { Episode } from '../episode';

/**
 * Sample episode: open Videos, open one video and show the Home preview clip card.
 * Demo data comes from the fixture build (ADMIN_DATA=fixture), see docs/spikes/kb-recording.md.
 */
const episode: Episode = {
  id: 'home-preview',
  title: 'Find the Home preview clip of a video',
  role: 'admin',
  screens: ['/admin/videos', '/admin/videos/[id]'],
  dependsOn: ['apps/web/src/app/admin/videos', 'apps/web/src/components/admin/nav.ts'],
  steps: [
    {
      caption: 'Choose Videos to see every video you have uploaded.',
      run: async (s) => {
        if (s.profile.mobile) {
          await s.click(s.page.getByRole('button', { name: 'Open menu' }));
        }
        await s.click(s.page.getByRole('link', { name: 'Videos', exact: true }).first());
        await s.page.getByRole('heading', { name: 'Videos' }).first().waitFor();
        await s.page.waitForLoadState('networkidle');
      },
      shot: {
        name: 'videos-list',
        marks: [
          {
            target: (s) => s.page.getByRole('link', { name: 'Staying Safe Online' }).first(),
            label: 'A video',
          },
        ],
      },
    },
    {
      caption: 'Open a video to edit it. Here we use Staying Safe Online.',
      run: async (s) => {
        await s.click(s.page.getByRole('link', { name: 'Staying Safe Online' }).first());
        await s.page.getByRole('heading', { name: 'Details' }).waitFor();
        await s.pause(800);
      },
    },
    {
      caption: 'Scroll down to the Home preview clip card.',
      run: async (s) => {
        await s.reveal(s.page.getByRole('heading', { name: 'Home preview clip' }), 0.2);
      },
    },
    {
      caption: 'Automatic lets us choose a short silent clip for the Home hero.',
      run: async (s) => {
        await s.point(s.page.getByText('How the clip is chosen'));
      },
      shot: {
        name: 'home-preview-card',
        marks: [
          {
            target: (s) => s.page.getByRole('heading', { name: 'Home preview clip' }),
            label: 'The card',
          },
          { target: (s) => s.page.getByText('How the clip is chosen'), label: 'Choose how' },
        ],
      },
    },
  ],
};

export default episode;
