import { AccountFrame } from '../../../../components/account/AccountFrame';
import { AdultsOnly } from '../../../../components/account/AccountStates';
import { ActivityView } from '../../../../components/account/ActivityView';
import { ACCOUNT_PAGES } from '../../../../components/account/pages';
import { getLibrary, getProfiles } from '../../../../lib/data';
import { requireProfile } from '../../../../lib/session';

export const metadata = { title: 'Viewing activity', robots: { index: false } };

export default async function ActivityPage() {
  const { session, profile, ctx } = await requireProfile('/account/activity');
  if (profile.kids) return <AdultsOnly profileName={profile.name} />;
  const profiles = await getProfiles().list(session.accountId);
  const initial = await getLibrary().activity(ctx);
  const copy = ACCOUNT_PAGES['/account/activity']!;
  return (
    <AccountFrame title={copy.title} lead={copy.lead}>
      <ActivityView
        profiles={profiles.map((p) => ({ id: p.id, name: p.name }))}
        activeId={profile.id}
        initial={initial}
      />
    </AccountFrame>
  );
}
