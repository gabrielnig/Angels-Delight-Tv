import type { Episode } from '../episode';
import { lookStep, navStep, rowLink } from '../c1-common';
import { clickByName, typeInto, waitForToast } from '../helpers';

/** D06 Choose or upload a poster: pick one of the six frames, check the crop, save. */
const episode: Episode = {
  id: 'D06',
  title: 'Choose or upload a poster',
  role: 'editor',
  screens: ['/admin/videos/[id]/poster'],
  actions: ['video.edit'],
  dependsOn: [
    'apps/web/src/components/admin/PosterPicker.tsx',
    'apps/web/src/app/admin/(shell)/videos/[id]/poster',
  ],
  next: 'D07 Review and approve captions',
  steps: [
    navStep('Videos', 'Choose **Videos** in the side menu.'),
    {
      caption: 'Type "Naira" in the **Search** box.',
      note: 'The list narrows as you type, so your video is easy to find.',
      holdMs: 2200,
      shot: {
        name: 'search',
        alt: 'The Search box with Naira typed and one video left in the list',
        marks: [{ target: (s) => s.page.getByLabel('Search', { exact: true }).first(), label: 'Search' }],
      },
      run: async (s) => {
        await typeInto(s, /^Search$/, 'Naira');
        await s.page.getByRole('link', { name: 'Counting Money in Naira', exact: true }).first().waitFor();
      },
    },
    {
      caption: 'Click **Edit Counting Money in Naira**.',
      holdMs: 1800,
      run: async (s) => {
        await s.click(rowLink(s, 'Edit Counting Money in Naira', 'Counting Money in Naira'));
        await s.page.getByRole('link', { name: 'Choose poster', exact: true }).waitFor();
      },
    },
    {
      caption: 'Click **Choose poster**.',
      holdMs: 1800,
      run: async (s) => {
        await clickByName(s, 'link', 'Choose poster', { exact: true });
        await s.page.getByRole('heading', { name: 'Pick a frame' }).waitFor();
      },
      shot: {
        name: 'frames',
        alt: 'The six frames to pick from, with the first marked 1',
        marks: [{ target: (s) => s.page.getByRole('button', { name: /^0:34/ }), label: 'A frame' }],
      },
    },
    {
      caption: 'Click **0:34 Use this**.',
      note: 'The time is where in the video the frame comes from.',
      holdMs: 2200,
      run: async (s) => {
        await clickByName(s, 'button', '0:34 Use this', { exact: true });
      },
    },
    lookStep(
      'Scroll to **Crop and focus**.',
      (s) => s.page.getByRole('heading', { name: 'Crop and focus' }),
      { holdMs: 3000, shot: { name: 'crop', alt: 'The Crop and focus card with the focus point marked 1', label: 'Crop and focus' } },
    ),
    {
      caption: 'Click **Save poster**.',
      holdMs: 1800,
      run: async (s) => {
        await clickByName(s, 'button', 'Save poster', { exact: true });
      },
    },
    {
      caption: 'Wait until you see **Poster saved**.',
      holdMs: 3000,
      run: async (s) => {
        await waitForToast(s, 'Poster saved');
      },
      shot: {
        name: 'saved',
        alt: 'The message Poster saved marked 1',
        marks: [{ target: (s) => s.page.getByText('Poster saved').first(), label: 'Poster saved' }],
      },
    },
  ],
};

export default episode;
