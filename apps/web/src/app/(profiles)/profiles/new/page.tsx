import type { Metadata } from 'next';
import { KidsGate } from '../../../../components/KidsGate';
import { EditScreen } from '../../../../components/profiles/ProfileScreens';
import { getProfiles } from '../../../../lib/data';
import { requireSession } from '../../../../lib/session';

export const metadata: Metadata = { title: 'Add a profile' };

export default async function NewProfilePage() {
  const session = await requireSession('/profiles/new');
  if (session.profile?.kids) return <KidsGate what="Adding a profile" />;
  const repo = getProfiles();
  const profiles = await repo.list(session.accountId);
  return (
    <div className="web-profileform-wrap">
      <EditScreen limitReached={profiles.length >= repo.maxProfiles} lastAdult={false} />
    </div>
  );
}
