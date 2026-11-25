import type { Episode } from '../episode';
import { clickByName, highlight, scrollTo } from '../helpers';
import { menuTo, slow } from '../helpers-c7';

/** T12: the Home preview clip says Failed or Skipped. Read the note and use Retry. */
const episode: Episode = {
  id: 'T12',
  title: 'The preview clip says Failed or Skipped',
  role: 'editor',
  screens: ['/admin/videos/[id]'],
  actions: ['video.edit'],
  dependsOn: [
    'apps/web/src/components/admin/PreviewClipCard.tsx',
    'apps/web/src/lib/data/admin/kb-demo/trouble.ts',
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
      caption: 'Type "Decimals" in the **Search** box.',
      run: async (s) => {
        await s.type(s.page.getByRole('main').getByLabel('Search'), 'Decimals');
        await s.page.getByText('Decimals at the Market').first().waitFor();
      },
    },
    {
      caption: 'Click **Edit Decimals at the Market**.',
      run: async (s) => {
        await s.click(
          s.page
            .getByRole('main')
            .getByRole('link', { name: /Edit/ })
            .or(s.page.getByRole('main').getByRole('button', { name: /^Edit/ }))
            .first(),
        );
        await s.page.getByText('Home preview clip').first().waitFor();
      },
    },
    {
      caption: 'Scroll to **Home preview clip** on the right.',
      run: async (s) => {
        await scrollTo(s, s.page.getByText('Home preview clip').first());
      },
    },
    {
      caption: 'Check the **Preview clip** badge and the note under it.',
      note: 'Failed means the clip could not be cut. Skipped means the video did not suit a clip, for example it is very short. Either way Home shows the poster instead.',
      run: async (s) => {
        await highlight(s, s.page.getByText(/The preview clip could not be cut/).first());
      },
      shot: {
        name: 'failed',
        alt: 'The Home preview clip card with the Failed badge and note marked 1 and Retry marked 2',
        crop: (s) => s.page.locator('.adm-card').filter({ hasText: 'Home preview clip' }).last(),
        marks: [
          { target: (s) => s.page.getByText(/The preview clip could not be cut/).first(), label: 'The note' },
          { target: (s) => s.page.getByRole('button', { name: 'Retry' }), label: 'Retry' },
        ],
      },
    },
    {
      caption: 'Click **Retry** under the options.',
      run: async (s) => {
        await clickByName(s, 'button', 'Retry');
      },
    },
    {
      caption: 'Wait until the badge says **Queued**.',
      run: async (s) => {
        await s.page.getByText('Queued', { exact: true }).first().waitFor({ timeout: 15000 });
        await s.pause(1200);
      },
    },
  ],
};

export default slow(episode, 1500);
