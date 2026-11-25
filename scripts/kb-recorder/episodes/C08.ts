import type { Episode } from '../episode';
import { clickByName, goToScreen, highlight, padSteps, typeInto, waitForToast } from '../c3-helpers';

const episode: Episode = {
  id: 'C08',
  title: 'Publish an interface language',
  role: 'super_admin',
  screens: ['/admin/languages'],
  actions: ['i18n.publish', 'i18n.override'],
  covers: { nav: ['Languages'], settings: ['content.ui_languages', 'i18n.publish_min_percent'] },
  dependsOn: ['apps/web/src/components/admin/languages/LanguageTable.tsx', 'apps/web/src/app/admin/(shell)/languages'],
  next: 'C09 Translate the site text',
  steps: padSteps([
    {
      caption: 'Click **Languages** in the side menu.',
      run: async (s) => {
        await goToScreen(s, 'Languages');
        await s.page.getByRole('heading', { name: 'Languages' }).first().waitFor();
      },
      shot: {
        name: 'languages',
        alt: 'The Languages table with the Approved column marked 1',
        marks: [{ target: (s) => s.page.getByRole('columnheader', { name: 'Approved' }), label: 'Approved' }],
      },
    },
    {
      caption: 'Check the **Approved** column.',
      note: 'It shows how much of the core text a person has approved. A language can go live at 80 percent or more.',
      run: async (s) => highlight(s, s.page.getByRole('columnheader', { name: 'Approved' }), 2200),
    },
    {
      caption: 'Click **Publish anyway** beside Yorùbá.',
      note: 'Below 80 percent the switch is locked. Only a Super admin can publish anyway, and the reason is saved in the audit log.',
      run: async (s) => { await clickByName(s, 'button', 'Publish anyway', { first: true }); await s.page.getByRole('dialog').waitFor(); },
      shot: {
        name: 'override',
        alt: 'The Publish below the threshold box with the Reason box marked 1',
        marks: [{ target: (s) => s.page.getByLabel('Reason', { exact: true }), label: 'Reason' }],
      },
    },
    {
      caption: 'Type "Sample text for a first test." in the **Reason** box.',
      run: async (s) => typeInto(s, 'Reason', 'Sample text for a first test.'),
    },
    {
      caption: 'Click **Publish** to confirm.',
      note: 'Viewers see English for any text that is not translated yet.',
      run: async (s) => { await s.click(s.page.getByRole('dialog').getByRole('button', { name: 'Publish', exact: true })); await s.pause(1500); },
      shot: {
        name: 'live',
        alt: 'The Languages table with the Live column marked 1',
        marks: [{ target: (s) => s.page.getByRole('columnheader', { name: 'Live' }), label: 'Live' }],
      },
    },
    {
      caption: 'Check the **Live** badge.',
      note: 'The language picker now appears for viewers. Turn the Live switch off to take the language down again.',
      run: async (s) => highlight(s, s.page.getByText('Live', { exact: true }).first(), 2200),
    },
  ]),
};
export default episode;
