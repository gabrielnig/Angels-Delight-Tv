import type { Metadata } from 'next';
import { SearchView } from '@/components/admin/help/SearchView';
import { requireActor } from '@/lib/data/admin/session-next';
import { getLibrary, helpRole, wantsAll } from '@/server/help';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Search the help centre' };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function HelpSearchPage({ searchParams }: Props) {
  const actor = await requireActor('/admin/help/search');
  const query = await searchParams;
  const q = Array.isArray(query.q) ? (query.q[0] ?? '') : (query.q ?? '');
  return (
    <SearchView
      library={getLibrary()}
      query={q}
      role={helpRole(actor.role)}
      showAll={wantsAll(query.show)}
    />
  );
}
