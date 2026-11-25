import type { Episode } from '../episode';
import { clickByName, goToScreen, highlight, padSteps, typeInto } from '../c3-helpers';

const episode: Episode = {
  id: 'C09',
  title: 'Translate the site text',
  role: 'editor',
  screens: ['/admin/languages/[locale]'],
  actions: ['i18n.edit'],
  dependsOn: ['apps/web/src/components/admin/languages', 'apps/web/src/app/admin/(shell)/languages'],
  next: 'C08 Publish an interface language',
  steps: padSteps([
    {
      caption: 'Click **Languages** in the side menu.',
      run: async (s) => {
        await goToScreen(s, 'Languages');
        await s.page.getByRole('heading', { name: 'Languages' }).first().waitFor();
      },
    },
    {
      caption: 'Click **Translate** beside Yorùbá.',
      run: async (s) => { await clickByName(s, 'link', 'Translate', { first: true, exact: true }); await s.page.getByRole('searchbox', { name: 'Search keys and text' }).waitFor(); },
      shot: {
        name: 'workspace',
        alt: 'The translation workspace with the filter tabs marked 1',
        marks: [{ target: (s) => s.page.getByRole('tablist').first(), label: 'Filter tabs' }],
      },
    },
    {
      caption: 'Check the **Missing** tab.',
      note: 'The tabs are Missing, Stale, In review, Approved and All. Missing is text with no translation yet. Stale is text whose English changed after it was translated.',
      run: async (s) => highlight(s, s.page.getByRole('tab', { name: /^Missing/ }), 2200),
    },
    {
      caption: 'Click **Copy English** on the first line.',
      note: 'Copy English is only a starting point. Replace it with the real translation in the language you are working on.',
      run: async (s) => { await clickByName(s, 'button', 'Copy English', { first: true }); },
    },
    {
      caption: 'Click **Save** on the first line.',
      note: 'Saved lines go to In review. An Admin approves them. Nothing is live until the language is published.',
      run: async (s) => { await clickByName(s, 'button', 'Save', { first: true, exact: true }); await s.pause(1200); },
    },
    {
      caption: 'Check the **{wait}** mark on the second line.',
      note: 'A mark in curly brackets is filled in by the site, for example a number of minutes. Keep it exactly as written in your translation.',
      run: async (s) => highlight(s, s.page.getByText('{wait}', { exact: true }).first(), 2400),
      shot: {
        name: 'placeholder',
        alt: 'A line with the curly bracket mark marked 1',
        marks: [{ target: (s) => s.page.getByText('{wait}', { exact: true }).first(), label: 'Keep unchanged' }],
      },
    },
    {
      caption: 'Type "share" in the **Search keys and text** box.',
      run: async (s) => typeInto(s, 'Search keys and text', 'share'),
    },
    {
      caption: 'Check the **Export CSV** link.',
      note: 'Export CSV gives you the list as a spreadsheet for a translator. Import CSV brings the finished file back. Imported lines go to In review.',
      run: async (s) => highlight(s, s.page.getByRole('link', { name: 'Export CSV' }).first(), 2200),
    },
  ]),
};
export default episode;
