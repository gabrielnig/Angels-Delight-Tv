import type { Episode } from '../episode';
import { clickByName, highlight, waitForToast } from '../helpers';
import { menuTo, slow } from '../helpers-c7';

/** T03: captions are missing or wrong. Find the state, read the reason, try again, then review. */
const episode: Episode = {
  id: 'T03',
  title: 'Captions are missing or wrong',
  role: 'editor',
  screens: ['/admin/captions', '/admin/captions/[videoId]'],
  actions: ['caption.review'],
  covers: { nav: ['Captions'], statuses: ['caption:draft', 'caption:in_review'] },
  dependsOn: [
    'apps/web/src/components/admin/CaptionList.tsx',
    'apps/web/src/components/admin/CaptionReview.tsx',
    'apps/web/src/app/admin/(shell)/captions',
  ],
  steps: [
    {
      caption: 'Choose **Captions** in the side menu.',
      run: async (s) => {
        await menuTo(s, 'Captions');
        await s.page.getByRole('heading', { name: 'Captions' }).first().waitFor();
      },
      shot: {
        name: 'list',
        alt: 'The Captions list with the state column marked 1',
        marks: [
          {
            target: (s) => s.page.getByRole('columnheader', { name: 'State' }),
            label: 'State',
          },
        ],
      },
    },
    {
      caption: 'Check the **State** of your video.',
      note: 'None, Generating, Needs review, Failed and Approved each mean something different.',
      run: async (s) => {
        await highlight(s, s.page.getByRole('columnheader', { name: 'State' }));
      },
    },
    {
      caption: 'Click **Failed 1** above the list.',
      run: async (s) => {
        await s.click(s.page.getByRole('link', { name: /^Failed/ }).first());
        await s.page.getByText('Fractions with Jollof Rice').first().waitFor();
      },
    },
    {
      caption: 'Click **Retry captions for Fractions with Jollof Rice**.',
      run: async (s) => {
        await s.click(
          s.page
            .getByRole('row', { name: /Fractions with Jollof Rice/ })
            .getByRole('link')
            .last(),
        );
        await s.page.getByText('Captions could not be made for this video.').first().waitFor();
      },
    },
    {
      caption: 'Check that **Captions could not be made for this video** appears.',
      run: async (s) => {
        await highlight(s, s.page.getByText('Captions could not be made for this video.').first());
      },
      shot: {
        name: 'failed',
        alt: 'The red box with the reason and the Try again button marked 1',
        marks: [
          {
            target: (s) => s.page.getByRole('button', { name: 'Try again' }),
            label: 'Try again',
          },
        ],
      },
    },
    {
      caption: 'Click **Try again**.',
      note: 'You can also upload your own caption file with **Upload captions**.',
      run: async (s) => {
        await clickByName(s, 'button', 'Try again');
      },
    },
    {
      caption: 'Wait until **Making captions** appears.',
      run: async (s) => {
        await s.page.getByText(/Making captions|left\. You can leave this page/).first().waitFor();
        await s.pause(1500);
      },
    },
  ],
};

export default slow(episode, 1500);
