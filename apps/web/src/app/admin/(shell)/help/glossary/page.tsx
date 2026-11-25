import type { Metadata } from 'next';
import { GlossaryView } from '@/components/admin/help/GlossaryView';
import { requireActor } from '@/lib/data/admin/session-next';
import { getLibrary, helpRole } from '@/server/help';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Words explained' };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function HelpGlossaryPage({ searchParams }: Props) {
  const actor = await requireActor('/admin/help/glossary');
  const query = await searchParams;
  const q = Array.isArray(query.q) ? (query.q[0] ?? '') : (query.q ?? '');
  return (
    <GlossaryView library={getLibrary()} role={helpRole(actor.role)} filter={q.slice(0, 80)} />
  );
}
