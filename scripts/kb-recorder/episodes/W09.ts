import type { Episode } from '../episode';
import { clickByName, goToScreen, markLabel, padSteps, scrollTo, typeInto, waitForToast } from '../c3-helpers';

const episode: Episode = {
  id: 'W09',
  title: 'Turn captions on or off for one video',
  role: 'admin',
  actions: ['caption.availability'],
  dependsOn: ['apps/web/src/components/admin/VideoEditor.tsx', 'packages/theme/src/settings-registry.ts'],
  next: 'T03 Captions are missing or wrong',
  steps: padSteps([
    {
      caption: 'Click **Videos** in the side menu.',
      run: async (s) => { await goToScreen(s, 'Videos'); await s.page.getByRole('heading', { name: 'Videos' }).first().waitFor(); },
    },
    {
      caption: 'Click **Staying Safe Online** to open the video.',
      run: async (s) => { await clickByName(s, 'link', 'Staying Safe Online', { first: true }); await s.page.getByText('Captions for viewers').first().waitFor(); },
    },
    {
      caption: 'Scroll to **Captions for viewers**.',
      run: async (s) => { await scrollTo(s, s.page.getByText('Captions for viewers', { exact: true }).first(), 0.3); },
      shot: {
        name: 'card',
        alt: 'The Captions for viewers card with its three choices marked 1',
        marks: [{ target: (s) => s.page.getByText('Captions for viewers', { exact: true }).first(), label: 'Captions for viewers' }],
      },
    },
    {
      caption: 'Click **Off**.',
      note: 'The choices are On, Off and Follow site default. Follow site default uses the switch in Features and limits. Off hides the CC button for this video. Viewers who saved a caption choice keep it for other videos.',
      run: async (s) => { await clickByName(s, 'radio', 'Off', { exact: true }); },
    },
    {
      caption: 'Type "The demo clip has no speech." in the **Why are captions off?** box.',
      note: 'The reason is saved in the audit log.',
      run: async (s) => typeInto(s, 'Why are captions off?', 'The demo clip has no speech.'),
      shot: {
        name: 'off-reason',
        alt: 'The reason box under the Off choice marked 1',
        marks: [{ target: (s) => s.page.getByLabel('Why are captions off?', { exact: true }), label: 'Reason' }],
      },
    },
    {
      caption: 'Click **Save captions setting**.',
      run: async (s) => { await clickByName(s, 'button', 'Save captions setting'); await waitForToast(s, 'Captions setting saved.'); },
    },
  ]),
};
export default episode;
