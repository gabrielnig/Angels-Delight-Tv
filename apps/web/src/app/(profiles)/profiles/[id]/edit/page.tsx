import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { KidsGate } from '../../../../../components/KidsGate';
import { EditScreen } from '../../../../../components/profiles/ProfileScreens';
import { getProfiles } from '../../../../../lib/data';
import { requireSession } from '../../../../../lib/session';

export const metadata: Metadata = { title: 'Edit profile' };

export default async function EditProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireSession(`/profiles/${id}/edit`);
  if (session.profile?.kids) return <KidsGate what="Editing a profile" />;
  const repo = getProfiles();
  const [profile, profiles] = await Promise.all([repo.get(session.accountId, id), repo.list(session.accountId)]);
  if (!profile) notFound();
  const adults = profiles.filter((p) => !p.kids);
  return (
    <div className="web-profileform-wrap">
      <EditScreen profile={profile} limitReached={false} lastAdult={!profile.kids && adults.length === 1} />
    </div>
  );
}
