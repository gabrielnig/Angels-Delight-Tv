import type { Metadata } from 'next';
import { HelpHome } from '@/components/admin/help/HelpHome';
import { requireActor } from '@/lib/data/admin/session-next';
import { getLibrary, helpRole, supportContactSetting, wantsAll } from '@/server/help';

export const metadata: Metadata = { title: 'Help centre' };
export const dynamic = 'force-dynamic';

export default async function HelpHomePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const actor = await requireActor('/admin/help');
  const query = await searchParams;
  return (
    <HelpHome
      library={getLibrary()}
      role={helpRole(actor.role)}
      showAll={wantsAll(query.show)}
      supportContact={await supportContactSetting()}
    />
  );
}
