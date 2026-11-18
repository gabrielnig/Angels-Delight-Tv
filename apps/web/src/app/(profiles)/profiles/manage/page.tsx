import type { Metadata } from 'next';
import { KidsGate } from '../../../../components/KidsGate';
import { PickerScreen } from '../../../../components/profiles/ProfileScreens';
import { getProfiles } from '../../../../lib/data';
import { requireSession } from '../../../../lib/session';

export const metadata: Metadata = { title: 'Manage profiles' };

export default async function ManageProfilesPage() {
  const session = await requireSession('/profiles/manage');
  if (session.profile?.kids) return <KidsGate what="Managing profiles" />;
  const repo = getProfiles();
  const profiles = await repo.list(session.accountId);
  return (
    <PickerScreen
      accountId={session.accountId}
      profiles={profiles}
      max={repo.maxProfiles}
      mode="manage"
    />
  );
}
