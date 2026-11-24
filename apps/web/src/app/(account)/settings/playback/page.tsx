import { AccountFrame } from '../../../../components/account/AccountFrame';
import { PlaybackSettingsForm } from '../../../../components/account/PlaybackSettings';
import { ACCOUNT_PAGES } from '../../../../components/account/pages';
import { getAccount } from '../../../../lib/data';
import { requireProfile } from '../../../../lib/session';

export const metadata = { title: 'Playback settings' };

/** A Kids profile can open this screen too, with the parent controlled rows locked (S29 state 3). */
export default async function PlaybackPage() {
  const { profile } = await requireProfile('/settings/playback');
  const initial = await getAccount().playback(profile.id);
  const copy = ACCOUNT_PAGES['/settings/playback']!;
  return (
    <AccountFrame title={copy.title} lead={copy.lead}>
      <PlaybackSettingsForm initial={initial} kids={profile.kids} profileName={profile.name} />
    </AccountFrame>
  );
}
