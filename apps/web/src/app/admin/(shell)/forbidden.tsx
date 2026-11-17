import { NoAccess } from '@/components/admin/states';
import { ROLE_LABELS } from '@/lib/data/admin/session';
import { getActor } from '@/lib/data/admin/session-next';

/** Shown with a real HTTP 403 when a signed in person opens an admin page their role does not allow. */
export default async function Forbidden() {
  const actor = await getActor();
  return <NoAccess roleLabel={actor ? ROLE_LABELS[actor.role] : 'not set'} />;
}
