import type { Episode } from '../episode';
import { highlight } from '../helpers';
import { menuTo, slow } from '../helpers-c7';

/** T08: the site looks wrong after a theme change. Check contrast, look at Theme history, find Reset to default. */
const episode: Episode = {
  id: 'T08',
  title: 'The site looks wrong after a theme change',
  role: 'admin',
  screens: ['/admin/theme', '/admin/theme/history'],
  actions: ['settings.theme'],
  covers: { nav: ['Theme'] },
  dependsOn: ['apps/web/src/components/admin/theme', 'apps/web/src/app/admin/(shell)/theme'],
  steps: [
    {
      caption: 'Choose **Theme** in the side menu.',
      run: async (s) => {
        await menuTo(s, 'Theme');
        await s.page.getByRole('heading', { name: 'Theme' }).first().waitFor();
      },
    },
    {
      caption: 'Scroll to **Colours** to see the colour ratios.',
      note: 'Each pair shows a ratio and the word Pass or Fail. A pair that fails is hard to read for some people. Change it before you publish.',
      run: async (s) => {
        await s.reveal(s.page.getByText(/Ratios use WCAG/), 0.3);
        await highlight(s, s.page.getByText(/Ratios use WCAG/));
      },
      shot: {
        name: 'colours',
        alt: 'The Colours card with the contrast ratios marked 1',
        marks: [{ target: (s) => s.page.getByText(/Ratios use WCAG/), label: 'Contrast ratios' }],
      },
    },
    {
      caption: 'Click **Theme history**.',
      run: async (s) => {
        await s.page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
        await s.pause(800);
        await s.click(s.page.getByRole('link', { name: 'Theme history' }));
        await s.page.getByRole('heading', { name: 'Theme history' }).first().waitFor();
      },
    },
    {
      caption: 'Check the **Theme history** list.',
      note: 'Every theme you save or publish appears here. Click **Restore** next to a good one and choose **Restore as draft**. Nothing changes for viewers until you publish.',
      run: async (s) => {
        await highlight(s, s.page.getByText('Every saved version of the theme'));
      },
      shot: {
        name: 'history',
        alt: 'The Theme history screen with the list of saved versions marked 1',
        marks: [{ target: (s) => s.page.getByText('Every saved version of the theme'), label: 'Saved versions' }],
      },
    },
    {
      caption: 'Click **Back to theme**.',
      run: async (s) => {
        await s.click(s.page.getByRole('link', { name: 'Back to theme' }));
        await s.page.getByRole('heading', { name: 'Theme' }).first().waitFor();
      },
    },
    {
      caption: 'Scroll to **Reset to default** at the top.',
      note: 'Reset puts back the first look of the site. It asks you to confirm.',
      run: async (s) => {
        await highlight(s, s.page.getByRole('button', { name: 'Reset to default' }));
      },
    },
  ],
};

export default slow(episode, 1500);
