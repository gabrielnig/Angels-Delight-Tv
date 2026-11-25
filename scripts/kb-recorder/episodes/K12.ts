import type { Episode } from '../episode';
import { goToScreen } from '../helpers';
import { pointAt, settle } from '../safety-helpers';

/** K12: the viewer sign in switches and limits on Features and limits. Super admin. */
const episode: Episode = {
  id: 'K12',
  title: 'How viewers sign in: two step, Google and the new device email',
  role: 'super_admin',
  screens: ['/admin/site-settings'],
  actions: ['settings.flags'],
  covers: {
    settings: [
      'features.signin_with_google',
      'features.signups_open',
      'limits.lockout_attempts',
      'limits.lockout_minutes',
      'limits.max_sessions',
    ],
  },
  dependsOn: ['apps/web/src/components/admin/site/SiteSettingsView.tsx'],
  next: 'K11 Who can do what: staff roles in plain words',
  steps: [
    {
      caption: 'Choose **Site settings** in the side menu.',
      run: async (s) => {
        await goToScreen(s, 'Site settings');
        await s.page.getByRole('heading', { name: 'Site settings' }).first().waitFor();
      },
    },
    {
      caption: 'Click **Features and limits**.',
      run: async (s) => {
        await s.click(s.page.getByRole('tab', { name: 'Features and limits' }));
        await s.page.getByRole('switch', { name: 'Sign in with Google' }).waitFor();
        await settle(s, 600);
      },
    },
    {
      caption: 'Scroll to **Sign in with Google**.',
      note: 'The button shows only when this switch is on and the Google keys are set on the server by the developer.',
      run: async (s) => {
        const t = s.page.getByRole('switch', { name: 'Sign in with Google' });
        await s.reveal(t, 0.4);
        await pointAt(s, t);
      },
      shot: {
        name: 'google-switch',
        alt: 'The Sign in with Google switch, marked 1',
        marks: [{ target: (s) => s.page.getByRole('switch', { name: 'Sign in with Google' }), label: 'Sign in with Google' }],
      },
    },
    {
      caption: 'Scroll to **Open sign up**.',
      note: 'Off means new accounts need an invite code.',
      run: async (s) => {
        const t = s.page.getByRole('switch', { name: 'Open sign up' });
        await s.reveal(t, 0.4);
        await pointAt(s, t);
      },
    },
    {
      caption: 'Scroll to **Failed sign ins before lockout**.',
      note: 'After this many wrong passwords the account waits before it can try again.',
      run: async (s) => {
        const f = s.page.getByLabel('Failed sign ins before lockout');
        await s.reveal(f, 0.4);
        await pointAt(s, f);
      },
      shot: {
        name: 'lockout',
        alt: 'The lockout boxes: failed sign ins and lockout minutes, marked 1 and 2',
        marks: [
          { target: (s) => s.page.getByLabel('Failed sign ins before lockout'), label: 'Attempts' },
          { target: (s) => s.page.getByLabel('Lockout minutes'), label: 'Minutes' },
        ],
      },
    },
    {
      caption: 'Scroll to **Lockout minutes**.',
      run: async (s) => {
        const f = s.page.getByLabel('Lockout minutes');
        await s.reveal(f, 0.4);
        await pointAt(s, f);
      },
    },
    {
      caption: 'Scroll to **Sessions per account**.',
      note: 'This is how many devices one account can be signed in on at once.',
      run: async (s) => {
        const f = s.page.getByLabel('Sessions per account');
        await s.reveal(f, 0.4);
        await pointAt(s, f);
      },
    },
  ],
};

export default episode;
