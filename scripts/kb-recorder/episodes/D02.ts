import type { Episode } from '../episode';
import { DEMO_UPLOAD, navStep } from '../c1-common';

/** D02 Upload one video: the Upload screen, one file, wait for it, then open its details. */
const episode: Episode = {
  id: 'D02',
  title: 'Upload one video',
  role: 'editor',
  screens: ['/admin/videos/upload'],
  actions: ['video.upload'],
  covers: { nav: ['Upload'] },
  dependsOn: [
    'apps/web/src/app/admin/(shell)/videos/upload',
    'apps/web/src/components/admin/UploadScreen.tsx',
    'apps/web/src/components/admin/UploadLane.tsx',
  ],
  viewports: ['desktop', 'mobile'],
  next: 'D03 Upload many videos and share details',
  steps: [
    navStep('Upload', 'Choose **Upload** in the side menu.', {
      heading: 'Upload videos',
      shot: { name: 'upload', alt: 'The Upload page with the Choose videos button marked 1' },
    }),
    {
      caption: 'Click **Choose videos**.',
      holdMs: 1200,
      run: async (s) => {
        const [box] = await Promise.all([
          s.page.waitForEvent('filechooser'),
          s.click(s.page.getByRole('button', { name: 'Choose videos', exact: true })),
        ]);
        await box.setFiles(DEMO_UPLOAD);
      },
      shot: {
        name: 'choose',
        alt: 'The Choose videos button marked 1',
        marks: [{ target: (s) => s.page.getByRole('button', { name: 'Choose videos', exact: true }), label: 'Choose videos' }],
      },
    },
    {
      caption: 'Choose a file from your computer.',
      note: 'A box from your computer opens. Pick one MP4, MOV or MKV file.',
      holdMs: 2500,
      run: async (s) => {
        await s.page.getByText('demo-lesson.mp4').filter({ visible: true }).first().waitFor();
        await s.point(s.page.getByText('demo-lesson.mp4').filter({ visible: true }).first());
      },
      shot: {
        name: 'queue',
        alt: 'The Upload queue with the file and its progress bar marked 1',
        marks: [{ target: (s) => s.page.getByText('demo-lesson.mp4').filter({ visible: true }).first(), label: 'Your file' }],
      },
    },
    {
      caption: 'Wait until you see **Uploaded just now**.',
      note: 'Keep this page open until then. Closing it can stop the upload.',
      holdMs: 2200,
      run: async (s) => {
        await s.skippable(async () => {
          await s.page.getByText('Uploaded just now').filter({ visible: true }).first().waitFor({ timeout: 90_000 });
        });
      },
      shot: {
        name: 'done',
        alt: 'The finished upload with Uploaded just now marked 1',
        marks: [{ target: (s) => s.page.getByText('Uploaded just now').filter({ visible: true }).first(), label: 'Uploaded just now' }],
      },
    },
    {
      caption: 'Click **Edit details for demo-lesson.mp4**.',
      note: 'The name on this button is the name of your own file.',
      holdMs: 2200,
      run: async (s) => {
        const edit = s.page
          .getByRole('link', { name: 'Edit details for demo-lesson.mp4', exact: true })
          .or(s.page.getByRole('button', { name: 'Edit details for demo-lesson.mp4', exact: true }))
          .first();
        await s.click(edit);
        await s.page.getByRole('heading', { name: 'Details' }).first().waitFor();
      },
    },
    {
      caption: 'Wait until you see **Before you publish**.',
      note: 'Your video is now a draft. Nobody can watch it yet.',
      holdMs: 17000,
      run: async (s) => {
        await s.point(s.page.getByText('Before you publish').first());
      },
      shot: {
        name: 'draft',
        alt: 'The new draft video with the Before you publish card marked 1',
        marks: [{ target: (s) => s.page.getByText('Before you publish').first(), label: 'Before you publish' }],
      },
    },
  ],
};

export default episode;
