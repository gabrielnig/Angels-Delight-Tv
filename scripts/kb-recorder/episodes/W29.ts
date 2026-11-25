import type { Episode } from '../episode';
import { clickByName, goToScreen, typeInto, waitForToast } from '../helpers';

/** Add tags to a video so it is easy to find by subject. */
const episode: Episode = {
  id: 'W29',
  title: 'Organise your library with categories and tags',
  role: 'editor',
  screens: ['/admin/videos/[id]'],
  actions: ['video.edit'],
  dependsOn: ['apps/web/src/components/admin/VideoEditor.tsx'],
  next: 'W30 Change many videos at once',
  steps: [
    {
      caption: 'Choose **Videos** in the side menu.',
      run: async (s) => {
        await goToScreen(s, 'Videos');
      },
    },
    {
      caption: 'Click **Edit Demo lesson: Joseph is sold**.',
      run: async (s) => {
        await clickByName(s, 'link', 'Edit Demo lesson: Joseph is sold');
        await s.page.getByLabel('Tags').waitFor();
      },
    },
    {
      caption: 'Type "genesis, joseph" in the **Tags** box.',
      run: async (s) => {
        const box = s.page.getByLabel('Tags');
        await box.fill('');
        await s.type(box, 'genesis, joseph');
      },
      shot: {
        name: 'tags',
        alt: 'The Tags box with genesis and joseph typed in, marked 1',
        marks: [{ target: (s) => s.page.getByLabel('Tags'), label: 'Tags' }],
      },
    },
    {
      caption: 'Click **Save changes**.',
      run: async (s) => {
        await clickByName(s, 'button', 'Save changes');
        await waitForToast(s, /saved/i);
      },
    },
  ],
};
export default episode;
