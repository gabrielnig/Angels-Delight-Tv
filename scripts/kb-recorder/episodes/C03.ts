import type { Episode } from '../episode';
import { clickByName, goToScreen, highlight, padSteps, waitForToast } from '../c3-helpers';

const episode: Episode = {
  id: 'C03',
  title: 'Go back to an earlier theme',
  role: 'admin',
  screens: ['/admin/theme/history'],
  actions: ['settings.theme'],
  dependsOn: ['apps/web/src/components/admin/theme/ThemeHistoryView.tsx', 'apps/web/src/app/admin/(shell)/theme/history'],
  next: 'C02 Colours, fonts and logo with the Theme editor',
  steps: padSteps([
    {
      caption: 'Click **Theme** in the side menu.',
      run: async (s) => { await goToScreen(s, 'Theme'); await s.page.getByRole('heading', { name: 'Theme settings' }).first().waitFor(); },
    },
    {
      caption: 'Click **Theme history**.',
      run: async (s) => { await clickByName(s, 'link', 'Theme history'); await s.page.getByRole('heading', { name: 'Theme history' }).first().waitFor(); },
      shot: {
        name: 'history',
        alt: 'The Theme history table with the Status column marked 1',
        marks: [{ target: (s) => s.page.getByRole('columnheader', { name: 'Status' }), label: 'Status' }],
      },
    },
    {
      caption: 'Click **Published** to filter the list.',
      note: 'The filters are All, Published and Drafts. The Current badge marks the theme viewers see now.',
      run: async (s) => { await clickByName(s, 'button', /^Published/); },
    },
    {
      caption: 'Click **Restore version 1**.',
      note: 'Pick the older version you want back. View version shows its colours first.',
      run: async (s) => { await clickByName(s, 'button', 'Restore version 1'); await s.page.getByRole('dialog').waitFor(); },
      shot: {
        name: 'restore',
        alt: 'The Restore box with the Restore as draft button marked 1',
        marks: [{ target: (s) => s.page.getByRole('button', { name: 'Restore as draft' }), label: 'Restore as draft' }],
      },
    },
    {
      caption: 'Click **Restore as draft** to confirm.',
      note: 'This copies the old theme into your draft and opens the Theme screen. Viewers keep the current theme until you publish.',
      run: async (s) => { await clickByName(s, 'button', 'Restore as draft'); await s.page.getByRole('heading', { name: 'Theme settings' }).first().waitFor(); },
    },
    {
      caption: 'Click **Publish theme** and confirm.',
      note: 'Viewers see the earlier look on their next page load.',
      run: async (s) => {
        await clickByName(s, 'button', 'Publish theme', { first: true });
        await s.page.getByRole('dialog').waitFor();
        await s.click(s.page.getByRole('dialog').getByRole('button', { name: /^Publish/ }));
        await waitForToast(s, 'Theme published.');
      },
    },
  ]),
};
export default episode;
