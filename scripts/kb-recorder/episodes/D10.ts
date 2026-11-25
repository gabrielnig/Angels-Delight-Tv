import type { Episode } from '../episode';
import { lookStep, navStep } from '../c1-common';
import { clickByName, selectOption } from '../helpers';

/** D10 Find videos and change many at once: filter the list, select the rows, add a category, undo. */
const episode: Episode = {
  id: 'D10',
  title: 'Find videos and change many at once',
  role: 'editor',
  screens: ['/admin/videos'],
  actions: ['video.edit'],
  dependsOn: [
    'apps/web/src/components/admin/VideosList.tsx',
    'apps/web/src/components/admin/bulk',
    'apps/web/src/lib/data/admin/video-bulk.ts',
  ],
  next: 'D11 Delete a video and restore it from Trash',
  steps: [
    navStep('Videos', 'Choose **Videos** in the side menu.', {
      shot: { name: 'list', alt: 'The Videos list with the filters marked 1' },
    }),
    {
      caption: 'Select **Published** from the **Status** list.',
      holdMs: 2000,
      run: async (s) => {
        await selectOption(s, 'Status', 'Published');
        await s.pause(1500);
      },
      shot: {
        name: 'filter',
        alt: 'The Status filter set to Published, marked 1',
        marks: [{ target: (s) => s.page.getByLabel('Status', { exact: true }), label: 'Status' }],
      },
    },
    {
      caption: 'Tick **Select all on this page**.',
      holdMs: 2000,
      run: async (s) => {
        const box = s.page.getByLabel('Select all on this page', { exact: true });
        await s.point(box);
        await box.setChecked(true);
        await s.pause(600);
      },
      shot: {
        name: 'selected',
        alt: 'The bar that shows how many videos are selected, marked 1',
        marks: [{ target: (s) => s.page.getByRole('region', { name: 'Bulk actions' }), label: 'Selected' }],
      },
    },
    {
      caption: 'Click **Add to category**.',
      holdMs: 1800,
      run: async (s) => {
        await clickByName(s, 'button', 'Add to category', { exact: true });
        await s.page.getByRole('dialog').waitFor();
      },
    },
    {
      caption: 'Select **Science** from the **Category** list.',
      holdMs: 1800,
      run: async (s) => {
        const list = s.page.getByRole('dialog').getByLabel('Category', { exact: true });
        await s.click(list);
        await list.selectOption({ label: 'Science' });
        await s.pause(500);
      },
    },
    {
      caption: 'Click **Apply**.',
      holdMs: 1800,
      run: async (s) => {
        await clickByName(s, 'button', 'Apply', { exact: true });
      },
    },
    lookStep(
      'Check that **Select all on this page** is there if you want to start again.',
      (s) => s.page.getByLabel('Select all on this page', { exact: true }).first(),
      { holdMs: 17000, shot: { name: 'again', alt: 'The Select all on this page box marked 1', label: 'Start again' } },
    ),
  ],
};

export default episode;
