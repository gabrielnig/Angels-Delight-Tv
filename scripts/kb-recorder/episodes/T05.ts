import type { Episode } from '../episode';
import { slow } from '../helpers-c7';
import { clickByName, goToScreen, highlight } from '../helpers';

/** T05: an upload keeps failing. Check the file type and size, read the message, remove the file and add a good one. */
const episode: Episode = {
  id: 'T05',
  title: 'An upload keeps failing',
  role: 'editor',
  screens: ['/admin/videos/upload'],
  actions: ['video.upload'],
  covers: { nav: ['Upload'], statuses: ['video:uploading'] },
  dependsOn: [
    'apps/web/src/components/admin/UploadScreen.tsx',
    'apps/web/src/components/admin/UploadLane.tsx',
    'apps/web/src/lib/upload',
  ],
  steps: [
    {
      caption: 'Choose **Upload** in the side menu.',
      run: async (s) => {
        await goToScreen(s, 'Upload');
        await s.page.getByRole('heading', { name: 'Upload' }).first().waitFor();
      },
    },
    {
      caption: 'Check the **Files at once** line.',
      note: 'The limit is shown under the box. Only MP4, MOV and MKV files are accepted.',
      run: async (s) => {
        await highlight(s, s.page.getByText(/MP4, MOV or MKV\. Up to/).first());
      },
      shot: {
        name: 'limits',
        alt: 'The upload box with the accepted file types and the size limit marked 1',
        marks: [
          {
            target: (s) => s.page.getByText(/MP4, MOV or MKV\. Up to/).first(),
            label: 'File types and size',
          },
        ],
      },
    },
    {
      caption: 'Click **Choose videos** and pick a file.',
      run: async (s) => {
        const button = s.page.getByRole('button', { name: 'Choose videos' });
        const chooser = s.page.waitForEvent('filechooser');
        await clickByName(s, 'button', 'Choose videos');
        const picked = await chooser;
        await picked.setFiles({
          name: 'holiday.avi',
          mimeType: 'video/x-msvideo',
          buffer: Buffer.from('demo'),
        });
        await button.waitFor();
      },
    },
    {
      caption: 'Check the **Upload queue** for the message under the file name.',
      note: 'The message says what is wrong with that file. Other files in the same batch carry on.',
      run: async (s) => {
        await highlight(s, s.page.getByText(/is not supported\. Use MP4, MOV or MKV/).first());
      },
      shot: {
        name: 'message',
        alt: 'A file that was not added, with the reason marked 1 and the Remove button',
        marks: [
          {
            target: (s) => s.page.getByText(/is not supported\. Use MP4, MOV or MKV/).first(),
            label: 'The reason',
          },
        ],
      },
    },
    {
      caption: 'Select a file that was not added and click **Remove**.',
      run: async (s) => {
        await s.click(
          s.page.getByRole('list', { name: 'Files that were not added' }).getByRole('button').first(),
        );
      },
    },
  ],
};

export default slow(episode, 2800);
