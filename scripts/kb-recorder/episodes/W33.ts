import type { Episode } from '../episode';
import { goToScreen, highlight } from '../helpers';

/**
 * Upload many videos and set the details together. Choosing files is manual and is not run in fixture mode, so this
 * recording shows the Upload screen and the details area only (see the lane note).
 */
const episode: Episode = {
  id: 'W33',
  title: 'Upload many videos and set the details together',
  role: 'editor',
  screens: ['/admin/videos/upload'],
  actions: ['video.upload'],
  dependsOn: [
    'apps/web/src/components/admin/UploadScreen.tsx',
    'apps/web/src/components/admin/UploadDetailsForm.tsx',
  ],
  next: 'W30 Change many videos at once',
  steps: [
    {
      caption: 'Choose **Upload** in the side menu.',
      holdMs: 3000,
      run: async (s) => {
        await goToScreen(s, 'Upload');
      },
      shot: {
        name: 'upload',
        alt: 'The Upload screen with the drop box marked 1',
        marks: [
          {
            target: (s) => s.page.getByRole('heading', { name: 'Upload' }).first(),
            label: 'Upload',
          },
        ],
      },
    },
    {
      caption: 'Check that **Upload** lists the file types you can add.',
      holdMs: 3000,
      run: async (s) => {
        await highlight(s, s.page.getByRole('heading', { name: 'Upload' }).first());
      },
    },
  ],
};
export default episode;
