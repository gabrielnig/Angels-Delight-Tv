import type { Episode } from '../episode';
import { navStep } from '../c1-common';
import { clickByName, typeInto } from '../helpers';

/** S08 Use this help centre: search, open a guide, mark it done and say if it helped. */
const episode: Episode = {
  id: 'S08',
  title: 'Use this help centre: search, print, offline',
  role: 'editor',
  actions: ['admin.access'],
  dependsOn: ['apps/web/src/components/admin/help', 'apps/web/src/app/admin/(shell)/help'],
  next: 'D01 Check the Dashboard',
  steps: [
    navStep('Help centre', 'Choose **Help centre** in the side menu.'),
    {
      caption: 'Type "captions" in the **Search the help centre** box.',
      note: 'Press the slash key on your keyboard to jump to this box from anywhere in the help centre.',
      holdMs: 1500,
      run: async (s) => {
        await typeInto(s, 'Search the help centre', 'captions');
      },
    },
    {
      caption: 'Click **Search**.',
      holdMs: 1500,
      run: async (s) => {
        await clickByName(s, 'button', 'Search', { exact: true });
        await s.page.getByRole('link', { name: 'Review and approve captions', exact: true }).waitFor();
      },
      shot: {
        name: 'results',
        alt: 'The search results with Review and approve captions marked 1',
        marks: [{ target: (s) => s.page.getByRole('link', { name: 'Review and approve captions', exact: true }), label: 'A guide' }],
      },
    },
    {
      caption: 'Click **Review and approve captions**.',
      holdMs: 1800,
      run: async (s) => {
        await clickByName(s, 'link', 'Review and approve captions', { exact: true });
        await s.page.getByRole('heading', { name: 'Review and approve captions' }).first().waitFor();
      },
      shot: {
        name: 'guide',
        alt: 'The guide with the Print or save as PDF button marked 1',
        marks: [{ target: (s) => s.page.getByRole('button', { name: 'Print or save as PDF' }), label: 'Print or save as PDF' }],
      },
    },
    {
      caption: 'Click **Mark as done** when you have finished a guide.',
      holdMs: 2000,
      run: async (s) => {
        await clickByName(s, 'button', 'Mark as done', { exact: true });
        await s.pause(600);
      },
    },
    {
      caption: 'Click **Yes** if the guide helped you.',
      holdMs: 22400,
      run: async (s) => {
        await clickByName(s, 'button', 'Yes', { exact: true });
        await s.pause(600);
      },
      shot: {
        name: 'helpful',
        alt: 'The Was this helpful question with Yes marked 1',
        marks: [{ target: (s) => s.page.getByRole('button', { name: 'Yes', exact: true }), label: 'Yes' }],
      },
    },
  ],
};

export default episode;
