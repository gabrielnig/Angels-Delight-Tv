import type { Episode } from '../episode';
import { clickByName, goToScreen, selectOption, typeInto, waitForToast } from '../helpers';

/** Choose the series names for the whole site (Site settings, Series names tab). */
const episode: Episode = {
  id: 'W21',
  title: 'Choose the series names for your whole site',
  role: 'admin',
  screens: ['/admin/site-settings'],
  actions: ['settings.site'],
  covers: { nav: ['Site settings'], settings: ['content.series_labels'] },
  dependsOn: [
    'apps/web/src/components/admin/site/SeriesNamesTab.tsx',
    'apps/web/src/components/admin/site/SeriesNamesFields.tsx',
  ],
  next: 'W22 Use different names for one series',
  steps: [
    {
      caption: 'Choose **Site settings** in the side menu.',
      run: async (s) => {
        await goToScreen(s, 'Site settings');
      },
    },
    {
      caption: 'Click the **Series names** tab.',
      run: async (s) => {
        await clickByName(s, 'tab', 'Series names');
      },
      shot: {
        name: 'tab',
        alt: 'The Series names tab with the Name set list marked 1',
        marks: [{ target: (s) => s.page.getByLabel('Name set'), label: 'Name set' }],
      },
    },
    {
      caption: 'Select **Part and Lesson** from the **Name set** list.',
      run: async (s) => {
        await selectOption(s, 'Name set', 'Part and Lesson');
      },
      shot: {
        name: 'preview',
        alt: 'The preview list showing how Part and Lesson will read, marked 1',
        marks: [{ target: (s) => s.page.getByRole('list', { name: 'Preview' }), label: 'Preview' }],
      },
    },
    {
      caption: 'Type "Gen" in the **Item code** box.',
      run: async (s) => {
        await typeInto(s, 'Item code', 'Gen');
      },
    },
    {
      caption: 'Click **Save changes**.',
      run: async (s) => {
        await clickByName(s, 'button', 'Save changes');
        await waitForToast(s, 'Series names saved.');
      },
    },
  ],
};
export default episode;
