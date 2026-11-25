import type { Episode } from '../episode';
import { lookStep, navStep } from '../c1-common';

/** S04 Find your way around: the side menu groups, the count badges, the top bar and the account menu. */
const account = (s: import('../session').Session) =>
  s.page.locator('summary').filter({ hasText: 'Account menu' });

const episode: Episode = {
  id: 'S04',
  title: 'Find your way around: menu, top bar and phone menu',
  role: 'editor',
  screens: ['/admin'],
  actions: ['admin.access'],
  dependsOn: [
    'apps/web/src/components/admin/AdminShell.tsx',
    'apps/web/src/components/admin/nav.ts',
    'apps/web/src/components/admin/admin.css',
  ],
  viewports: ['desktop', 'mobile'],
  next: 'S05 Who can do what: Editor, Admin and Super admin',
  steps: [
    {
      caption: 'Check that the **Content** group holds your video screens.',
      note: 'On a phone, tap the menu button at the top left to open the side menu.',
      holdMs: 3400,
      run: async (s) => {
        const heading = s.page.getByRole('heading', { name: 'Content', exact: true });
        if (s.profile.mobile) {
          await s.click(s.page.getByRole('button', { name: 'Open menu' }));
          await s.point(heading);
          await s.pause(1800);
          await s.click(s.page.getByRole('button', { name: 'Close menu' }));
        } else {
          await s.point(heading);
        }
      },
      shot: {
        name: 'menu',
        alt: 'The side menu with the Content group marked 1',
        marks: [{ target: (s) => s.page.getByRole('heading', { name: 'Content', exact: true }), label: 'Content' }],
      },
    },
    navStep('Videos', 'Choose **Videos** in the side menu to open a screen.', {
      shot: { name: 'videos', alt: 'The Videos screen with its heading marked 1' },
    }),
    navStep('Dashboard', 'Choose **Dashboard** in the side menu to go back.'),
    {
      caption: 'Check that a number beside **Captions** shows how many videos wait.',
      holdMs: 3400,
      run: async (s) => {
        const link = s.page.getByRole('link', { name: /^Captions/ }).first();
        if (s.profile.mobile) {
          await s.click(s.page.getByRole('button', { name: 'Open menu' }));
          await s.point(link);
          await s.pause(1500);
          await s.click(s.page.getByRole('button', { name: 'Close menu' }));
        } else {
          await s.point(link);
        }
      },
    },
    {
      caption: 'Click **Account menu for Demo Editor** at the top right.',
      note: 'Your own name is on the button.',
      holdMs: 3000,
      run: async (s) => {
        await s.click(account(s));
        await s.page.getByText('Preview site').first().waitFor();
      },
      shot: {
        name: 'account',
        alt: 'The account menu open with Preview site marked 1',
        marks: [{ target: (s) => s.page.getByText('Preview site').first(), label: 'Preview site' }],
      },
    },
    lookStep(
      'Check that **Preview site** shows the site the way viewers see it.',
      (s) => s.page.getByText('Preview site').first(),
      { holdMs: 3400 },
    ),
    lookStep(
      'Check that **Sign out** is in this menu.',
      (s) => s.page.getByRole('button', { name: 'Sign out' }),
      { holdMs: 3400, shot: { name: 'signout', alt: 'The Sign out button marked 1', label: 'Sign out' } },
    ),
  ],
};

export default episode;
