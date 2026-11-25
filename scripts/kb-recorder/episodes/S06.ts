import type { Episode } from '../episode';
import { DEMO_UPLOAD, lookStep, navStep } from '../c1-common';
import { clickByName, selectOption, typeInto, waitForToast } from '../helpers';

/**
 * S06 Your first video from start to finish. The practice site makes no captions for a new upload, so the video stops
 * when the checklist shows what is left. Approving captions and publishing are in D07 and D08.
 */
const episode: Episode = {
  id: 'S06',
  title: 'Your first video from start to finish',
  role: 'editor',
  screens: ['/admin/videos/upload', '/admin/videos/[id]', '/admin/videos/[id]/poster'],
  actions: ['video.upload', 'video.edit'],
  dependsOn: [
    'apps/web/src/components/admin/UploadScreen.tsx',
    'apps/web/src/components/admin/VideoEditor.tsx',
    'apps/web/src/components/admin/PosterPicker.tsx',
  ],
  next: 'S07 See your site the way a viewer sees it',
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
        await box.setFiles(DEMO_UPLOAD);
      },
    },
    {
      caption: 'Choose a file from your computer.',
      holdMs: 2000,
      run: async (s) => {
        await s.page.getByText('demo-lesson.mp4').filter({ visible: true }).first().waitFor();
      },
      shot: {
        name: 'queue',
        alt: 'The Upload queue with the file uploading, marked 1',
        marks: [{ target: (s) => s.page.getByText('demo-lesson.mp4').filter({ visible: true }).first(), label: 'Your file' }],
      },
    },
    {
      caption: 'Wait until you see **Uploaded just now**.',
      holdMs: 2000,
      run: async (s) => {
        await s.skippable(async () => {
          await s.page.getByText('Uploaded just now').filter({ visible: true }).first().waitFor({ timeout: 90_000 });
        });
      },
    },
    {
      caption: 'Click **Edit details for demo-lesson.mp4**.',
      holdMs: 2000,
      run: async (s) => {
        const edit = s.page
          .getByRole('link', { name: 'Edit details for demo-lesson.mp4', exact: true })
          .or(s.page.getByRole('button', { name: 'Edit details for demo-lesson.mp4', exact: true }))
          .first();
        await s.click(edit);
        await s.page.getByLabel('Description', { exact: true }).waitFor();
      },
    },
    {
      caption: 'Type "Learn how to save money on mobile data." in the **Description** box.',
      holdMs: 1800,
      run: async (s) => {
        await typeInto(s, 'Description', 'Learn how to save money on mobile data.');
      },
      shot: {
        name: 'details',
        alt: 'The Description box filled in, marked 1',
        marks: [{ target: (s) => s.page.getByLabel('Description', { exact: true }), label: 'Description' }],
      },
    },
    {
      caption: 'Tick **Life Skills**.',
      holdMs: 1800,
      run: async (s) => {
        const box = s.page.getByLabel('Life Skills', { exact: true });
        await s.point(box);
        await box.setChecked(true);
        await s.pause(500);
      },
    },
    {
      caption: 'Select **G** from the **Maturity rating** list.',
      holdMs: 1800,
      run: async (s) => {
        await selectOption(s, 'Maturity rating', 'G');
      },
    },
    {
      caption: 'Click **Save changes**.',
      holdMs: 1800,
      run: async (s) => {
        await clickByName(s, 'button', 'Save changes', { exact: true });
      },
    },
    {
      caption: 'Wait until you see **Changes saved**.',
      holdMs: 2200,
      run: async (s) => {
        await waitForToast(s, 'Changes saved');
      },
    },
    lookStep(
      'Check that **Before you publish** shows what is left to do.',
      (s) => s.page.getByText('Before you publish').first(),
      { holdMs: 3200, shot: { name: 'checklist', alt: 'The Before you publish checklist marked 1', label: 'Checklist' } },
    ),
    {
      caption: 'Click **Choose poster**.',
      holdMs: 1800,
      run: async (s) => {
        await clickByName(s, 'link', 'Choose poster', { exact: true });
        await s.page.getByRole('heading', { name: 'Pick a frame' }).waitFor();
      },
      shot: {
        name: 'poster',
        alt: 'The poster picker with the Save poster button marked 1',
        marks: [{ target: (s) => s.page.getByRole('button', { name: 'Save poster', exact: true }), label: 'Save poster' }],
      },
    },
    lookStep(
      'Check that **Save poster** is on the screen.',
      (s) => s.page.getByRole('button', { name: 'Save poster', exact: true }),
      { holdMs: 3400, shot: { name: 'save-poster', alt: 'The Save poster button marked 1', label: 'Save poster' } },
    ),
  ],
};

export default episode;
