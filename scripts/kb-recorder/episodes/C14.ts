import type { Episode } from '../episode';
import { goToScreen, scrollTo } from '../helpers';

const episode: Episode = {
  id: 'C14',
  title: 'System: jobs, storage and player quality',
  role: 'admin',
  screens: ['/admin/system'],
  actions: ['system.view'],
  covers: {'nav': ['System']},
  dependsOn: ['apps/web/src/app/admin/(shell)/system', 'apps/web/src/components/admin/SystemView.tsx'],
  next: 'T10 Storage is nearly full',
  steps: [
    {
      caption: 'Choose **System** in the side menu.',
      note: 'Admins can look. Only a Super admin can Retry or Discard a failed job.',
      holdMs: 3500,
      run: async (s) => {
        await goToScreen(s, 'System');
        await s.page.getByRole('heading', { name: 'System' }).first().waitFor();
      },
      shot: {
        name: 'system',
        alt: 'The System page with its tabs marked 1',
        marks: [{ target: (s) => s.page.getByRole('tab', { name: 'Storage' }), label: 'Tabs' }],
      },
    },
    {
      caption: 'Check that **Storage used** is on the page.',
      note: 'The bar shows how much of your storage budget is used. A warning appears before it is full.',
      holdMs: 3500,
      run: async (s) => {
        await s.point(s.page.getByText('Storage used').first());
      },
    },
    {
      caption: 'Click **Player quality**.',
      note: "This is measured on viewers' devices over the last 7 days.",
      holdMs: 3500,
      run: async (s) => {
        await s.click(s.page.getByRole('tab', { name: 'Player quality', exact: true }));
      },
      shot: {
        name: 'quality',
        alt: 'The Player quality tab with the start time tile marked 1',
        marks: [{ target: (s) => s.page.getByText('Typical start time'), label: 'Start time' }],
      },
    },
    {
      caption: 'Check that **Typical start time** shows a number.',
      note: 'A long start time or a lot of stalling means viewers are on slow connections.',
      holdMs: 3500,
      run: async (s) => {
        await s.point(s.page.getByText('Typical start time'));
      },
    },
    {
      caption: 'Click **Storage**.',
      holdMs: 3500,
      run: async (s) => {
        await s.click(s.page.getByRole('tab', { name: 'Storage', exact: true }));
      },
    },
  ],
};

export default episode;
