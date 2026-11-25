import type { Episode } from '../episode';
import { goToScreen } from '../helpers';

/** Approve many captions at once from the Captions list (Admin). */
const episode: Episode = {
  id: 'W31',
  title: 'Approve many captions at once',
  role: 'admin',
  screens: ['/admin/captions'],
  actions: ['caption.approve_bulk'],
  covers: { nav: ['Captions'] },
  dependsOn: ['apps/web/src/components/admin/CaptionTable.tsx'],
  next: 'W32 Retry many failed encodes at once',
  steps: [
    {
      caption: 'Choose **Captions** in the side menu.',
      run: async (s) => {
        await goToScreen(s, 'Captions');
      },
    },
    {
      caption: 'Tick **Select all on this page**.',
      run: async (s) => {
        await s.click(s.page.getByLabel('Select all on this page').first());
      },
      shot: {
        name: 'selected',
        alt: 'The caption list with rows ticked and the Approve button in the bar, marked 1',
        marks: [
          { target: (s) => s.page.getByRole('button', { name: /^Approve \d/ }), label: 'Approve' },
        ],
      },
    },
    {
      caption: 'Click **Approve** in the bar.',
      run: async (s) => {
        await s.click(s.page.getByRole('button', { name: /^Approve \d/ }).first());
        await s.pause(1000);
      },
    },
  ],
};
export default episode;
