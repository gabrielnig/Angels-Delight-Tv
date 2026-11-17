import { PlaybackSettingsForm } from '../../../../components/account/PlaybackSettings';
import { getAccount } from '../../../../lib/data';
import { requireProfile } from '../../../../lib/session';

export const metadata = { title: 'Playback settings' };

export default async function PlaybackPage() {
  const { profile } = await requireProfile('/settings/playback');
  const initial = await getAccount().playback(profile.id);
  return (
    <>
      <h1 className="web-page__title">Playback</h1>
      <PlaybackSettingsForm initial={initial} />
    </>
  );
}
