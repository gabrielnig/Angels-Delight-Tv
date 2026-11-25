import type { Episode } from '../episode';
import { clickByName, highlight, markLabel, openSiteSettings, openTab, padSteps, saveChanges, typeInto, waitForToast } from '../c3-helpers';

const episode: Episode = {
  id: 'C04',
  title: 'Features and limits: what each switch does',
  role: 'super_admin',
  screens: ['/admin/site-settings'],
  actions: ['settings.flags'],
  covers: {
    settings: [
      'features.signups_open', 'features.kids_profiles', 'features.my_list', 'features.autoplay_hero', 'features.data_saver_default',
      'features.require_approved_captions', 'features.captions_default_available', 'features.guest_play', 'features.airplay',
      'features.signin_with_google', 'limits.max_profiles', 'limits.max_sessions', 'limits.upload_max_bytes', 'limits.guest_segment_minutes',
      'limits.lockout_attempts', 'limits.lockout_minutes', 'playback.finish_percent', 'playback.start_threshold_seconds',
      'playback.rewind_seconds', 'playback.countdown_seconds', 'analytics.raw_retention_days', 'audit.retention_months',
    ],
  },
  dependsOn: ['apps/web/src/components/admin/site/SiteSettingsView.tsx', 'packages/theme/src/settings-registry.ts'],
  next: 'C05 Home and Discovery settings',
  steps: padSteps([
    {
      caption: 'Click **Site settings** in the side menu.',
      run: async (s) => { await openSiteSettings(s); },
    },
    {
      caption: 'Click **Features and limits** at the top.',
      note: 'Only a Super admin can change this tab. Admins can read it but the switches are locked.',
      run: async (s) => { await openTab(s, 'Features and limits'); },
      shot: {
        name: 'features',
        alt: 'The Features and limits tab with the Open sign up switch marked 1',
        marks: [markLabel('Open sign up', 'Open sign up', 'switch')],
      },
    },
    {
      caption: 'Check the hint under **Open sign up**.',
      note: 'Every switch has a hint that says what it does. The full list is in the settings dictionary, guide R04.',
      run: async (s) => highlight(s, s.page.getByText('Anyone can create an account.').first(), 2200),
    },
    {
      caption: 'Untick **Guests can watch**.',
      note: 'With this off, visitors can browse but must sign in to play a video.',
      run: async (s) => { await clickByName(s, 'switch', 'Guests can watch'); },
      shot: {
        name: 'guests-off',
        alt: 'The Guests can watch switch turned off and marked 1',
        marks: [markLabel('Guests can watch', 'Guests can watch', 'switch')],
      },
    },
    {
      caption: 'Type "3" in the **Profiles per account** box.',
      note: 'Limits have a range. A number outside it shows a red message and cannot be saved.',
      run: async (s) => typeInto(s, 'Profiles per account', '3'),
    },
    {
      caption: 'Click **Save changes**.',
      run: async (s) => { await saveChanges(s); await waitForToast(s, 'Features and limits saved.'); },
      note: 'The message Features and limits saved appears. Changes reach viewers within a minute.',
      shot: {
        name: 'saved',
        alt: 'The saved message at the bottom of the Features and limits tab',
        marks: [{ target: (s) => s.page.getByRole('status').filter({ hasText: 'saved' }).first(), label: 'Saved' }],
      },
    },
  ]),
};
export default episode;
