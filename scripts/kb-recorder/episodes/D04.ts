import type { Episode } from '../episode';
import { DEMO_UPLOAD, navStep } from '../c1-common';
import { clickByName } from '../helpers';

/**
 * D04 Fix an upload that stopped or failed. On the practice site a file with "flaky" in its name loses its last part
 * once, so Retry can be shown. The saved part is kept, so Retry sends only what is missing.
 */
const episode: Episode = {
  id: 'D04',
  title: 'Fix an upload that stopped or failed',
  role: 'editor',
  screens: ['/admin/videos/upload'],
  actions: ['video.upload'],
  dependsOn: ['apps/web/src/components/admin/UploadScreen.tsx', 'apps/web/src/components/admin/UploadLane.tsx', 'apps/web/src/lib/uploader'],
  next: 'D05 Add the title, description and categories',
  steps: [
    navStep('Upload', 'Choose **Upload** in the side menu.', { heading: 'Upload videos' }),
    {
      caption: 'Click **Choose videos**.',
      holdMs: 1200,
      run: async (s) => {
        const [box] = await Promise.all([
          s.page.waitForEvent('filechooser'),
          s.click(s.page.getByRole('button', { name: 'Choose videos', exact: true })),
        ]);
        await box.setFiles({ ...DEMO_UPLOAD, name: 'flaky-lesson.mp4' });
      },
    },
    {
      caption: 'Choose a file from your computer, named "flaky-lesson.mp4".',
      note: 'To practise, give your file a name with the word flaky in it. On your real site, any file can fail when the connection drops.',
      holdMs: 2200,
      run: async (s) => {
        await s.page.getByText('flaky-lesson.mp4').filter({ visible: true }).first().waitFor();
      },
    },
    {
      caption: 'Wait until you see **Retry**.',
      note: 'The row shows why it stopped. The part that was sent is kept.',
      holdMs: 2500,
      run: async (s) => {
        await s.skippable(async () => {
          await s.page.getByRole('button', { name: 'Retry flaky-lesson.mp4', exact: true }).waitFor({ timeout: 120_000 });
        });
      },
      shot: {
        name: 'failed',
        alt: 'The failed upload with the Retry button marked 1',
        marks: [{ target: (s) => s.page.getByRole('button', { name: 'Retry flaky-lesson.mp4', exact: true }), label: 'Retry' }],
      },
    },
    {
      caption: 'Click **Retry flaky-lesson.mp4**.',
      holdMs: 1800,
      run: async (s) => {
        await clickByName(s, 'button', 'Retry flaky-lesson.mp4', { exact: true });
      },
    },
    {
      caption: 'Wait until you see **Uploaded just now**.',
      holdMs: 16000,
      run: async (s) => {
        await s.skippable(async () => {
          await s.page.getByText('Uploaded just now').filter({ visible: true }).first().waitFor({ timeout: 120_000 });
        });
      },
      shot: {
        name: 'done',
        alt: 'The upload finished, marked 1',
        marks: [{ target: (s) => s.page.getByText('Uploaded just now').filter({ visible: true }).first(), label: 'Uploaded just now' }],
      },
    },
  ],
};

export default episode;
