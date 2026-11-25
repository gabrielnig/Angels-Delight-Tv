import type { Episode } from '../episode';
import { clickByName, highlight, markLabel, openSiteSettings, openTab, padSteps, typeInto, waitForToast } from '../c3-helpers';

const episode: Episode = {
  id: 'C07',
  title: 'Invite codes for early access',
  role: 'admin',
  screens: ['/admin/site-settings'],
  actions: ['settings.site'],
  dependsOn: ['apps/web/src/components/admin/site/InviteCodesTab.tsx'],
  next: 'C08 Publish an interface language',
  steps: padSteps([
    {
      caption: 'Click **Site settings** in the side menu.',
      run: async (s) => { await openSiteSettings(s); },
    },
    {
      caption: 'Click **Invite codes** at the top.',
      note: 'Visitors need a code only when Open sign up is off in Features and limits. Otherwise this tab says sign up is open.',
      run: async (s) => { await openTab(s, 'Invite codes'); },
      shot: {
        name: 'codes',
        alt: 'The Invite codes tab with the Label box marked 1',
        marks: [markLabel('Label', 'Label'), markLabel('Uses allowed', 'Uses allowed')],
      },
    },
    {
      caption: 'Type "Church group" in the **Label** box.',
      note: 'The label is for you only. Viewers never see it.',
      run: async (s) => typeInto(s, 'Label', 'Church group'),
    },
    {
      caption: 'Type "20" in the **Uses allowed** box.',
      note: 'This is how many people can sign up with the code.',
      run: async (s) => typeInto(s, 'Uses allowed', '20'),
    },
    {
      caption: 'Click **Create code**.',
      run: async (s) => { await clickByName(s, 'button', 'Create code'); await s.page.getByText('New code:').first().waitFor(); },
    },
    {
      caption: 'Check the **New code:** message and copy the code.',
      note: 'The full code is shown once. Copy it now and send it to your group. Later you only see the last characters.',
      run: async (s) => highlight(s, s.page.getByText('New code:').first(), 2500),
      shot: {
        name: 'new-code',
        alt: 'The new code message marked 1',
        marks: [{ target: (s) => s.page.getByText('New code:').first(), label: 'New code' }],
      },
    },
    {
      caption: 'Click **Revoke code Church group** to stop the code.',
      note: 'Revoke when a group is full or a code was shared by mistake.',
      run: async (s) => { await clickByName(s, 'button', 'Revoke code Church group'); await s.page.getByRole('dialog').waitFor(); },
    },
    {
      caption: 'Click **Revoke code** to confirm.',
      note: 'Accounts already made with the code are not affected.',
      run: async (s) => { await s.click(s.page.getByRole('dialog').getByRole('button', { name: 'Revoke code', exact: true })); await waitForToast(s, 'Code revoked.'); },
      shot: {
        name: 'revoked',
        alt: 'The Codes table with the status marked 1',
        marks: [{ target: (s) => s.page.getByRole('table', { name: 'Sign up invite codes' }), label: 'Status' }],
      },
    },
  ]),
};
export default episode;
