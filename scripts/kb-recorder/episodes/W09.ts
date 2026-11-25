import type { Episode } from '../episode';
import { goToScreen, scrollTo } from '../helpers';

const TITLE = 'Washing Hands the Right Way';

const episode: Episode = {
  id: 'W09',
  title: 'Turn captions on or off for one video',
  role: 'admin',
  screens: ['/admin/videos/[id]'],
  actions: ['caption.availability'],
  covers: { nav: ['Videos'] },
  dependsOn: ['apps/web/src/app/admin/(shell)/videos/[id]', 'apps/web/src/components/admin/VideoEditor.tsx'],
  next: 'W10 Read Analytics',
  steps: [
    {
      caption: 'Choose **Videos** in the side menu.',
      run: async (s) => {
        await goToScreen(s, 'Videos');
        await s.page.getByRole('heading', { name: 'Videos' }).first().waitFor();
      },
    },
    {
      caption: `Click **${TITLE}**.`,
      run: async (s) => {
        await s.click(s.page.getByRole('link', { name: TITLE }).first());
        await s.page.getByText('Captions for viewers').first().waitFor();
      },
    },
    {
      caption: 'Scroll to **Captions for viewers**.',
      note: 'Only Admins and Super admins can change this card. Editors see it greyed out.',
      run: async (s) => {
        await scrollTo(s, s.page.getByRole('heading', { name: 'Captions for viewers' }));
      },
      shot: {
        name: 'card',
        alt: 'The Captions for viewers card with the On, Off and Follow site default choices marked 1',
        marks: [{ target: (s) => s.page.getByRole('heading', { name: 'Captions for viewers' }), label: 'Captions for viewers' }],
      },
    },
    {
      caption: 'Select **Off**.',
      note: 'Off hides the captions button for this video. Viewers who saved a choice keep it for other videos.',
      run: async (s) => {
        await s.click(s.page.getByRole('radio', { name: 'Off', exact: true }));
      },
    },
    {
      caption: 'Click **Save captions setting**.',
      run: async (s) => {
        await s.click(s.page.getByRole('button', { name: 'Save captions setting', exact: true }));
        await s.pause(800);
      },
      shot: {
        name: 'saved',
        alt: 'The Captions for viewers card after saving, with Off chosen and marked 1',
        marks: [{ target: (s) => s.page.getByRole('radio', { name: 'Off', exact: true }), label: 'Off' }],
      },
    },
    {
      caption: 'Select **Follow site default (currently on)**.',
      note: 'Choose this again to put things back. Captions return for viewers.',
      run: async (s) => {
        await s.click(s.page.getByRole('radio', { name: /^Follow site default/ }));
      },
    },
    {
      caption: 'Click **Save captions setting**.',
      run: async (s) => {
        await s.click(s.page.getByRole('button', { name: 'Save captions setting', exact: true }));
        await s.pause(800);
      },
    },
  ],
};

export default episode;
