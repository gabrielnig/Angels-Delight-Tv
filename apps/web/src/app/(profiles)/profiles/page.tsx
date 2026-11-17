import type { Metadata } from 'next';
import { PickerScreen } from '../../../components/profiles/ProfileScreens';
import { getProfiles } from '../../../lib/data';
import { requireSession } from '../../../lib/session';

export const metadata: Metadata = { title: 'Who is watching?' };

export default async function ProfilesPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const [session, params] = await Promise.all([requireSession('/profiles'), searchParams]);
  const repo = getProfiles();
  const profiles = await repo.list(session.accountId);
  return <PickerScreen profiles={profiles} max={repo.maxProfiles} mode="pick" autoSkip={params.switch !== '1'} />;
}
