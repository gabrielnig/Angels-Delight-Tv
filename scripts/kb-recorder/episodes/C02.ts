import type { Episode } from '../episode';
import { clickByName, goToScreen, highlight, markLabel, padSteps, typeInto, waitForToast } from '../c3-helpers';

const episode: Episode = {
  id: 'C02',
  title: 'Colours, fonts and logo with the Theme editor',
  role: 'admin',
  screens: ['/admin/theme'],
  actions: ['settings.theme'],
  covers: { nav: ['Theme'] },
  dependsOn: ['apps/web/src/components/admin/theme', 'apps/web/src/app/admin/(shell)/theme', 'packages/theme/src/presets.ts'],
  next: 'C03 Go back to an earlier theme',
  steps: padSteps([
    {
      caption: 'Click **Theme** in the side menu.',
      run: async (s) => {
        await goToScreen(s, 'Theme');
        await s.page.getByRole('heading', { name: 'Theme settings' }).first().waitFor();
      },
      shot: {
        name: 'theme',
        alt: 'The Theme screen with the Ready made themes list marked 1',
        marks: [{ target: (s) => s.page.getByText('Ready made themes').first(), label: 'Ready made themes' }],
      },
    },
    {
      caption: 'Check the **Ready made themes** and pick one.',
      note: 'A ready made theme sets all the colours at once. You can still change any colour after.',
      run: async (s) => {
        await highlight(s, s.page.getByText('Ready made themes').first(), 1200);
        await s.click(s.page.getByRole('radio', { name: /^Sky blue/ }));
      },
    },
    {
      caption: 'Type "#1e3a8a" in the **Primary** box.',
      note: 'Primary is the colour of buttons. Type a hex colour such as #1e3a8a, or use the colour picker beside the box.',
      run: async (s) => typeInto(s, 'Primary', '#1e3a8a'),
      shot: {
        name: 'colours',
        alt: 'The Colours card with the Primary box marked 1',
        marks: [{ target: (s) => s.page.getByLabel('Primary', { exact: true }), label: 'Primary' }],
      },
    },
    {
      caption: 'Check that the contrast badge says **Pass**.',
      note: 'Pass means the text can be read. Low or Too low means some people will struggle to read it.',
      run: async (s) => highlight(s, s.page.getByText('Pass').first(), 2000),
    },
    {
      caption: 'Check the **Fonts** list and pick one.',
      run: async (s) => {
        await highlight(s, s.page.getByText('Fonts', { exact: true }).first(), 1000);
        await s.click(s.page.getByRole('radio', { name: /^DM Sans/ }));
      },
    },
    {
      caption: 'Type "Learn With Angels" in the **Platform name** box.',
      note: 'To add a logo, use the logo file button in the Logo and name card.',
      run: async (s) => typeInto(s, 'Platform name', 'Learn With Angels'),
    },
    {
      caption: 'Click **Watch** in the live preview.',
      note: 'The preview tabs are Home, Watch and Sign in. Mobile shows a phone sized view.',
      run: async (s) => { await clickByName(s, 'tab', 'Watch', { exact: true }); },
      shot: {
        name: 'preview',
        alt: 'The live preview of the Watch screen marked 1',
        marks: [{ target: (s) => s.page.getByRole('tablist', { name: 'Preview screen' }), label: 'Preview tabs' }],
      },
    },
    {
      caption: 'Click **Save draft**.',
      note: 'A draft is not shown to viewers.',
      run: async (s) => { await clickByName(s, 'button', 'Save draft'); await waitForToast(s, 'Draft saved.'); },
    },
    {
      caption: 'Click **Publish theme** and confirm.',
      note: 'Viewers see the new look on their next page load. The old theme stays in history.',
      run: async (s) => {
        await clickByName(s, 'button', 'Publish theme', { first: true });
        await s.page.getByRole('dialog').waitFor();
        await s.click(s.page.getByRole('dialog').getByRole('button', { name: /^Publish/ }));
        await waitForToast(s, 'Theme published.');
      },
    },
  ]),
};
export default episode;
