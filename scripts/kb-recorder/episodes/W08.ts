import type { Episode } from '../episode';
import { clickByName, goToScreen, highlight, padSteps } from '../c3-helpers';

/**
 * Fixture mode shows only the start of this procedure: the demo has English as the only caption language and no
 * translation engine, so the Add a translation box says every language is done. The article says so.
 */
const episode: Episode = {
  id: 'W08',
  title: 'Add a caption language and publish it',
  role: 'admin',
  screens: [],
  actions: ['caption.translate', 'caption.publish_language'],
  covers: { settings: ['content.languages'] },
  dependsOn: ['apps/web/src/components/admin/captions', 'apps/web/src/app/admin/(shell)/captions'],
  next: 'C08 Publish an interface language',
  steps: padSteps([
    {
      caption: 'Click **Captions** in the side menu.',
      run: async (s) => { await goToScreen(s, 'Captions'); await s.page.getByRole('heading', { name: 'Captions' }).first().waitFor(); },
    },
    {
      caption: 'Click **How to Save Money on Data**.',
      run: async (s) => { await clickByName(s, 'link', 'How to Save Money on Data', { first: true }); await s.page.getByRole('button', { name: 'Add translation' }).waitFor(); },
      shot: {
        name: 'review',
        alt: 'The caption screen with the Add translation button marked 1',
        marks: [{ target: (s) => s.page.getByRole('button', { name: 'Add translation' }), label: 'Add translation' }],
      },
    },
    {
      caption: 'Check the **Add translation** button.',
      note: 'Only Admins and Editors with approved captions can start a translation. The video needs approved captions in its spoken language first.',
      run: async (s) => highlight(s, s.page.getByRole('button', { name: 'Add translation' }), 2400),
    },
    {
      caption: 'Click **Add translation**.',
      run: async (s) => { await clickByName(s, 'button', 'Add translation'); await s.page.getByRole('dialog').waitFor(); },
    },
    {
      caption: 'Check the **Add a translation** box.',
      note: 'On your site it lists each caption language that is turned on and has no translation yet. Choose one, then Start translation.',
      run: async (s) => highlight(s, s.page.getByRole('dialog'), 2600),
      shot: {
        name: 'dialog',
        alt: 'The Add a translation box marked 1',
        marks: [{ target: (s) => s.page.getByRole('dialog'), label: 'Add a translation' }],
      },
    },
    {
      caption: 'Click **Cancel**.',
      note: 'In this demo only English is turned on and no translation engine is connected, so the box ends here.',
      run: async (s) => { await clickByName(s, 'button', 'Cancel', { exact: true }); },
    },
  ]),
};
export default episode;
