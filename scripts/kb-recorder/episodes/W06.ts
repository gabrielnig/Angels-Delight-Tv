import type { Episode } from '../episode';
import { goToScreen } from '../helpers';

const TITLE = 'How to Save Money on Data';

const episode: Episode = {
  id: 'W06',
  title: 'Add skip intro, recap and chapters',
  role: 'editor',
  screens: ['/admin/videos/[id]/markers'],
  actions: ['video.markers'],
  dependsOn: ['apps/web/src/app/admin/(shell)/videos/[id]/markers', 'apps/web/src/components/admin/MarkerEditor.tsx'],
  next: 'W07 Edit captions in detail',
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
        await s.page.getByRole('link', { name: 'Set up skip and chapters' }).waitFor();
      },
    },
    {
      caption: 'Click **Set up skip and chapters**.',
      run: async (s) => {
        await s.click(s.page.getByRole('link', { name: 'Set up skip and chapters' }));
        await s.page.getByLabel('Intro start', { exact: true }).waitFor();
      },
      shot: {
        name: 'markers',
        alt: 'The Skip and chapters page with the Intro start box marked 1',
        marks: [{ target: (s) => s.page.getByLabel('Intro start', { exact: true }), label: 'Intro start' }],
      },
    },
    {
      caption: 'Type "0:05" in the **Intro start** box.',
      note: 'Use minutes and seconds, like 0:05. You can also play the video and click Use current time.',
      run: async (s) => {
        await s.type(s.page.getByLabel('Intro start', { exact: true }), '0:05');
      },
    },
    {
      caption: 'Type "0:20" in the **Intro end** box.',
      note: 'Viewers get a Skip intro button between these two times.',
      run: async (s) => {
        await s.type(s.page.getByLabel('Intro end', { exact: true }), '0:20');
      },
      shot: {
        name: 'intro',
        alt: 'The Intro start and Intro end boxes filled in, with Intro end marked 1',
        marks: [{ target: (s) => s.page.getByLabel('Intro end', { exact: true }), label: 'Intro end' }],
      },
    },
    {
      caption: 'Click **Save changes**.',
      note: 'Viewers see the change straight away.',
      run: async (s) => {
        await s.click(s.page.getByRole('button', { name: 'Save changes', exact: true }));
        await s.pause(800);
      },
      shot: {
        name: 'save',
        alt: 'The Skip and chapters page after saving, with the confirmation message marked 1',
        marks: [{ target: (s) => s.page.getByText('Saved. Viewers see this now.').first(), label: 'Saved' }],
      },
    },
  ],
};

export default episode;
