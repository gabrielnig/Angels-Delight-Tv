import type { Episode } from '../episode';
import { lookStep, navStep, rowLink } from '../c1-common';
import { clickByName, selectOption, typeInto, waitForToast } from '../helpers';

/** D05 Add the title, description and categories: the Details card of a video that has no description yet. */
const episode: Episode = {
  id: 'D05',
  title: 'Add the title, description and categories',
  role: 'editor',
  screens: ['/admin/videos', '/admin/videos/[id]'],
  actions: ['video.edit'],
  covers: { nav: ['Videos'] },
  dependsOn: [
    'apps/web/src/components/admin/VideoEditor.tsx',
    'apps/web/src/components/admin/VideosList.tsx',
    'apps/web/src/app/admin/(shell)/videos/[id]',
  ],
  viewports: ['desktop', 'mobile'],
  next: 'D06 Choose or upload a poster',
  steps: [
    navStep('Videos', 'Choose **Videos** in the side menu.', {
      shot: { name: 'list', alt: 'The Videos list with the Videos menu item marked 1' },
    }),
    {
      caption: 'Type "Naira" in the **Search** box.',
      note: 'The list narrows as you type, so your video is easy to find.',
      holdMs: 2200,
      shot: {
        name: 'search',
        alt: 'The Search box with Naira typed and one video left in the list',
        marks: [{ target: (s) => s.page.getByLabel('Search', { exact: true }), label: 'Search' }],
      },
      run: async (s) => {
        await typeInto(s, 'Search', 'Naira');
        await s.page.getByRole('link', { name: 'Counting Money in Naira', exact: true }).first().waitFor();
      },
    },
    {
      caption: 'Click **Edit Counting Money in Naira**.',
      holdMs: 1800,
      run: async (s) => {
        await s.click(rowLink(s, 'Edit Counting Money in Naira', 'Counting Money in Naira'));
        await s.page.getByLabel('Title', { exact: true }).waitFor();
      },
    },
    lookStep(
      'Check that the **Title** says what viewers will learn.',
      (s) => s.page.getByLabel('Title', { exact: true }),
      { shot: { name: 'title', alt: 'The Title box marked 1', label: 'Title' } },
    ),
    {
      caption: 'Type "Learn how to count and compare naira notes and coins." in the **Description** box.',
      note: 'Start with what viewers will learn. The counter shows how many characters you may use.',
      holdMs: 2200,
      run: async (s) => {
        await typeInto(s, 'Description', 'Learn how to count and compare naira notes and coins.');
      },
      shot: {
        name: 'description',
        alt: 'The Description box with the counter marked 1',
        marks: [{ target: (s) => s.page.getByLabel('Description', { exact: true }), label: 'Description' }],
      },
    },
    {
      caption: 'Tick **Maths**.',
      note: 'A video can have more than one category. Viewers find it in each one.',
      holdMs: 2000,
      run: async (s) => {
        const box = s.page.getByLabel('Maths', { exact: true });
        await s.point(box);
        await box.setChecked(true);
        await s.pause(500);
      },
      shot: {
        name: 'categories',
        alt: 'The Categories boxes with Maths marked 1',
        marks: [{ target: (s) => s.page.getByLabel('Maths', { exact: true }), label: 'Maths' }],
      },
    },
    {
      caption: 'Type "naira, money, counting" in the **Tags** box.',
      note: 'Separate tags with commas. You can add up to 10.',
      holdMs: 1800,
      run: async (s) => {
        await typeInto(s, 'Tags', 'naira, money, counting');
      },
    },
    {
      caption: 'Select **G** from the **Maturity rating** list.',
      note: 'G is the only rating that Kids profiles see.',
      holdMs: 2000,
      run: async (s) => {
        await selectOption(s, 'Maturity rating', 'G');
      },
      shot: {
        name: 'rating',
        alt: 'The Maturity rating list marked 1',
        marks: [{ target: (s) => s.page.getByLabel('Maturity rating', { exact: true }), label: 'Maturity rating' }],
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
      holdMs: 3000,
      run: async (s) => {
        await waitForToast(s, 'Changes saved');
      },
      shot: {
        name: 'saved',
        alt: 'The message Changes saved marked 1',
        marks: [{ target: (s) => s.page.getByText('Changes saved').first(), label: 'Changes saved' }],
      },
    },
  ],
};

export default episode;
