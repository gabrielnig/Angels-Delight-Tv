import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { PathView } from '@/components/admin/help/PathView';
import { requireActor } from '@/lib/data/admin/session-next';
import { getLibrary, helpRole, wantsAll } from '@/server/help';

export const dynamic = 'force-dynamic';

type Props = {
  params: Promise<{ path: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { path } = await params;
  const found = getLibrary().paths.find((p) => p.key === path);
  return { title: found ? found.title : 'Help centre' };
}

export default async function HelpPathPage({ params, searchParams }: Props) {
  const { path } = await params;
  const actor = await requireActor(`/admin/help/path/${path}`);
  const library = getLibrary();
  if (!library.paths.some((p) => p.key === path)) notFound();
  const query = await searchParams;
  return (
    <PathView
      library={library}
      pathKey={path}
      role={helpRole(actor.role)}
      showAll={wantsAll(query.show)}
    />
  );
}
