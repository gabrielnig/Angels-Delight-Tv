import type { Episode } from '../episode';
import { goToScreen, scrollTo } from '../helpers';

const episode: Episode = {
  id: 'W07',
  title: 'Edit captions in detail',
  role: 'editor',
  screens: ['/admin/captions/[videoId]'],
  actions: ['caption.review'],
  dependsOn: ['apps/web/src/app/admin/(shell)/captions', 'apps/web/src/components/admin/CaptionReview.tsx'],
  next: 'W08 Add a caption language and publish it',
  steps: [
    {
      caption: 'Click **Review captions**.',
      note: 'It is in Needs attention on the Dashboard. You can also open Captions in the side menu.',
      holdMs: 3500,
      run: async (s) => {
        await s.click(s.page.getByRole('link', { name: 'Review captions', exact: true }));
        await s.page.getByRole('button', { name: 'Find and replace' }).waitFor();
      },
      shot: {
        name: 'review',
        alt: 'The caption screen with the cue list marked 1',
        marks: [{ target: (s) => s.page.getByRole('button', { name: 'Find and replace' }), label: 'Caption tools' }],
      },
    },
    {
      caption: 'Type " now" in the **Words in cue 1** box.',
      note: 'Your change is saved by itself. Fix wrong words, names and numbers.',
      holdMs: 3500,
      run: async (s) => {
        await s.type(s.page.getByLabel('Words in cue 1', { exact: true }), ' now');
      },
    },
    {
      caption: 'Click **Undo**.',
      note: 'Undo and Redo step back and forward through your changes.',
      holdMs: 3500,
      run: async (s) => {
        await s.click(s.page.getByRole('button', { name: 'Undo', exact: true }));
      },
    },
    {
      caption: 'Click **Redo**.',
      holdMs: 3500,
      run: async (s) => {
        await s.click(s.page.getByRole('button', { name: 'Redo', exact: true }));
      },
    },
    {
      caption: 'Click **Find and replace**.',
      note: 'Use it when one word is wrong in many cues, such as a name.',
      holdMs: 3500,
      run: async (s) => {
        await s.click(s.page.getByRole('button', { name: 'Find and replace', exact: true }));
        await s.page.getByRole('dialog').waitFor();
      },
      shot: {
        name: 'find',
        alt: 'The Find and replace box with the Find field marked 1',
        marks: [{ target: (s) => s.page.getByLabel('Find', { exact: true }), label: 'Find' }],
      },
    },
    {
      caption: 'Click **Close**.',
      holdMs: 3500,
      run: async (s) => {
        await s.click(s.page.getByRole('dialog').getByRole('button', { name: 'Close', exact: true }));
      },
    },
  ],
};

export default episode;
