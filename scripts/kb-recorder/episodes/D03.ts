import type { Episode } from '../episode';
import { DEMO_UPLOAD, lookStep, navStep } from '../c1-common';
import { clickByName, selectOption } from '../helpers';

/** D03 Upload many videos and share details: details set once apply to every file added after. */
const episode: Episode = {
  id: 'D03',
  title: 'Upload many videos and share details',
  role: 'editor',
  screens: ['/admin/videos/upload'],
  actions: ['video.upload'],
  dependsOn: [
    'apps/web/src/components/admin/UploadScreen.tsx',
    'apps/web/src/components/admin/UploadDetailsForm.tsx',
    'apps/web/src/components/admin/UploadOverrides.tsx',
  ],
  next: 'D04 Fix an upload that stopped or failed',
  steps: [
    navStep('Upload', 'Choose **Upload** in the side menu.', {
      heading: 'Upload videos',
      shot: { name: 'details', alt: 'The Details for every file card with the categories marked 1', },
    }),
    {
      caption: 'Tick **Science** to give every file this category.',
      holdMs: 1800,
      run: async (s) => {
        const box = s.page.getByLabel('Science', { exact: true });
        await s.point(box);
        await box.setChecked(true);
        await s.pause(500);
      },
      shot: {
        name: 'category',
        alt: 'The Science category box ticked and marked 1',
        marks: [{ target: (s) => s.page.getByLabel('Science', { exact: true }), label: 'Science' }],
      },
    },
    {
      caption: 'Select **Everyone** from the **Suitability** list.',
      holdMs: 1800,
      run: async (s) => {
        await selectOption(s, 'Suitability', 'Everyone');
      },
    },
    {
      caption: 'Select **2 at a time** from the **Files at once** list.',
      note: 'Sending two files at once is faster. Use 1 at a time on a slow connection.',
      holdMs: 1800,
      run: async (s) => {
        await selectOption(s, 'Files at once', '2 at a time');
      },
      shot: {
        name: 'parallel',
        alt: 'The Files at once list marked 1',
        marks: [{ target: (s) => s.page.getByLabel('Files at once', { exact: true }), label: 'Files at once' }],
      },
    },
    {
      caption: 'Click **Choose videos**.',
      holdMs: 1200,
      run: async (s) => {
        const [box] = await Promise.all([
          s.page.waitForEvent('filechooser'),
          s.click(s.page.getByRole('button', { name: 'Choose videos', exact: true })),
        ]);
        await box.setFiles([
          { ...DEMO_UPLOAD, buffer: Buffer.alloc(12 * 1024 * 1024), name: 'lesson-one.mp4' },
          { ...DEMO_UPLOAD, buffer: Buffer.alloc(12 * 1024 * 1024), name: 'lesson-two.mp4' },
          { ...DEMO_UPLOAD, buffer: Buffer.alloc(12 * 1024 * 1024), name: 'lesson-three.mp4' },
        ]);
      },
    },
    {
      caption: 'Choose a file from your computer.',
      note: 'Hold the Ctrl key to pick more than one file. The files upload side by side.',
      holdMs: 2800,
      run: async (s) => {
        await s.page.getByText('lesson-one.mp4').filter({ visible: true }).first().waitFor();
      },
      shot: {
        name: 'queue',
        alt: 'The Upload queue with three files uploading, marked 1',
        marks: [{ target: (s) => s.page.getByText('lesson-one.mp4').filter({ visible: true }).first(), label: 'Your files' }],
      },
    },
    {
      caption: 'Wait until you see **Uploaded just now**.',
      holdMs: 2200,
      run: async (s) => {
        await s.skippable(async () => {
          await s.page.getByText('Uploaded just now').filter({ visible: true }).first().waitFor({ timeout: 120_000 });
        });
      },
    },
    lookStep(
      'Check that **Details were saved with the draft**.',
      (s) => s.page.getByText('Details were saved with the draft').filter({ visible: true }).first(),
      { holdMs: 7000, shot: { name: 'saved', alt: 'The note that details were saved with the draft, marked 1', label: 'Details saved' } },
    ),
  ],
};

export default episode;
