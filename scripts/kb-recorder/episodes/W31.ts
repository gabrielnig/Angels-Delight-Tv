import type { Episode } from '../episode';
import { goToScreen, highlight } from '../helpers';

/**
 * Approve many captions at once from the Captions list (Admin). The demo has no caption that is ready for bulk
 * approval, so the recording stops at the selection bar and the click on Approve is not shown (see the lane note).
 */
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
      holdMs: 3000,
      run: async (s) => {
        await goToScreen(s, 'Captions');
      },
    },
    {
      caption: 'Click the **Needs review** filter.',
      holdMs: 2000,
      run: async (s) => {
        await s.click(s.page.getByRole('link', { name: /^Needs review/ }).first());
        await s.page.waitForLoadState('networkidle').catch(() => {});
      },
    },
    {
      caption: 'Tick **Select all on this page**.',
      holdMs: 3000,
      run: async (s) => {
        await s.click(s.page.getByLabel('Select all on this page').first());
      },
      shot: {
        name: 'selected',
        alt: 'The caption list with rows ticked and the Approve button in the bar, marked 1',
        marks: [
          { target: (s) => s.page.getByRole('button', { name: /^Approve/ }), label: 'Approve' },
        ],
      },
    },
    {
      caption: 'Check that **1 selected** shows in the bar.',
      holdMs: 2500,
      run: async (s) => {
        await highlight(s, s.page.getByText('1 selected').first());
      },
    },
  ],
};
export default episode;
