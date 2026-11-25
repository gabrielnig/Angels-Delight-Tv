import type { Episode } from '../episode';
import { highlight } from '../helpers';
import { menuTo, slow } from '../helpers-c7';

/** T16: the site feels slow or media is not loading. Read Player quality on System. */
const episode: Episode = {
  id: 'T16',
  title: 'The site feels slow or the media is not loading',
  role: 'admin',
  screens: ['/admin/system'],
  actions: ['system.view'],
  dependsOn: ['apps/web/src/components/admin/SystemView.tsx', 'apps/web/src/lib/data/admin/system-rules.ts'],
  steps: [
    {
      caption: 'Choose **System** in the side menu.',
      run: async (s) => {
        await menuTo(s, 'System');
        await s.page.getByRole('heading', { name: 'System' }).first().waitFor();
      },
    },
    {
      caption: 'Open the **Player quality** tab.',
      run: async (s) => {
        await s.click(s.page.getByRole('tab', { name: 'Player quality' }));
        await s.page.getByText('Typical start time').first().waitFor();
      },
      shot: {
        name: 'quality',
        alt: 'The Player quality tab with the start time marked 1',
        marks: [{ target: (s) => s.page.getByText('Typical start time').first(), label: 'Start time' }],
      },
    },
    {
      caption: 'Check the **Typical start time** figure.',
      note: 'This is how long viewers wait before a video starts. It is measured on their own devices over the last 7 days.',
      run: async (s) => {
        await highlight(s, s.page.getByText('Typical start time').first());
      },
    },
    {
      caption: 'Check the **Time spent stalling** figure.',
      note: 'Stalling means the video stops to load. A high figure points to a weak connection or a busy delivery network.',
      run: async (s) => {
        await highlight(s, s.page.getByText('Time spent stalling').first());
      },
    },
    {
      caption: 'Check the **Playback errors** table.',
      run: async (s) => {
        await s.reveal(s.page.getByRole('heading', { name: 'Playback errors' }), 0.3);
        await highlight(s, s.page.getByRole('heading', { name: 'Playback errors' }));
      },
    },
  ],
};

export default slow(episode, 3200);
