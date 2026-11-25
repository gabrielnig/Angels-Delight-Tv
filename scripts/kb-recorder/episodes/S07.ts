import type { Episode } from '../episode';
import { lookStep, navStep, rowLink } from '../c1-common';

/**
 * S07 See your site the way a viewer sees it. On a real build "Preview as viewer" opens the staff preview page. The
 * fixture stack has no streams and sends the link to the public watch page, which says the video is not available, so
 * the recording opens the preview page itself after the click. See docs/lanes/L14-content-C1.md.
 */
const episode: Episode = {
  id: 'S07',
  title: 'See your site the way a viewer sees it',
  role: 'editor',
  screens: ['/admin/videos/[id]/preview'],
  actions: ['video.edit'],
  dependsOn: [
    'apps/web/src/app/admin/(shell)/videos/[id]/preview',
    'apps/web/src/components/admin/PreviewPlayer.tsx',
    'apps/web/src/components/admin/VideoEditor.tsx',
  ],
  next: 'S08 Use this help centre: search, print, offline',
  steps: [
    navStep('Videos', 'Choose **Videos** in the side menu.'),
    {
      caption: 'Click **Edit Staying Safe Online**.',
      holdMs: 2800,
      run: async (s) => {
        await s.click(rowLink(s, 'Edit Staying Safe Online', 'Staying Safe Online'));
        await s.page.getByRole('link', { name: 'Preview as viewer' }).waitFor();
      },
    },
    lookStep(
      'Check that **Before you publish** shows what is left to do.',
      (s) => s.page.getByText('Before you publish').first(),
      { holdMs: 3400 },
    ),
    lookStep(
      'Check that **Preview as viewer** is on the video screen.',
      (s) => s.page.getByRole('link', { name: 'Preview as viewer' }),
      { holdMs: 3400, shot: { name: 'link', alt: 'The Preview as viewer link marked 1', label: 'Preview as viewer' } },
    ),
    {
      caption: 'Click **Preview as viewer**.',
      holdMs: 3400,
      run: async (s) => {
        const link = s.page.getByRole('link', { name: 'Preview as viewer', exact: true });
        await s.point(link);
        await s.page.evaluate((r) => window.__kb.highlight(r, 900), (await link.boundingBox())!);
        await s.pause(700);
        // The fixture link goes to the public watch page. A real build goes here, so the recording shows this page.
        await s.goto('/admin/videos/vid_safe_online/preview');
        await s.page.getByText('Only signed in staff can see this preview').first().waitFor();
        await s.point(s.page.getByText('Only signed in staff can see this preview').first());
      },
      shot: {
        name: 'notice',
        alt: 'The preview page with the staff only notice marked 1',
        marks: [{ target: (s) => s.page.getByText('Only signed in staff can see this preview').first(), label: 'Staff only' }],
      },
    },
  ],
};

export default episode;
