import { AccountFrame } from '../../../../components/account/AccountFrame';
import { AdultsOnly } from '../../../../components/account/AccountStates';
import { NotificationSettings } from '../../../../components/account/NotificationSettings';
import { ACCOUNT_PAGES } from '../../../../components/account/pages';
import { requireProfile } from '../../../../lib/session';

export const metadata = { title: 'Notifications' };

export default async function NotificationsSettingsPage() {
  const { profile } = await requireProfile('/account/notifications');
  if (profile.kids) return <AdultsOnly profileName={profile.name} />;
  const copy = ACCOUNT_PAGES['/account/notifications']!;
  return (
    <AccountFrame title={copy.title} lead={copy.lead}>
      <NotificationSettings profileId={profile.id} />
    </AccountFrame>
  );
}
