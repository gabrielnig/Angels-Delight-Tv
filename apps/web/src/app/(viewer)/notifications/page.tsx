import { AppShell } from '../../../components/Shell';
import { NoticesKidsState, NoticesView } from '../../../components/notices/NoticesView';
import { requireProfile } from '../../../lib/session';

export const metadata = { title: 'Notifications', robots: { index: false, follow: false } };

export default async function NotificationsPage() {
  const { profile } = await requireProfile('/notifications');
  return (
    <AppShell>
      <div className="web-page">
        {profile.kids ? <NoticesKidsState /> : <NoticesView profileId={profile.id} />}
      </div>
    </AppShell>
  );
}
