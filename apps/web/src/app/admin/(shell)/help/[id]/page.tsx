import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ArticleView } from '@/components/admin/help/ArticleView';
import { requireActor } from '@/lib/data/admin/session-next';
import { getLibrary, helpRole } from '@/server/help';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const article = getLibrary().byId.get(id.toUpperCase());
  return { title: article ? article.meta.title : 'Help centre' };
}

export default async function HelpArticlePage({ params }: Props) {
  const { id } = await params;
  const actor = await requireActor(`/admin/help/${id}`);
  const library = getLibrary();
  const article = library.byId.get(id.toUpperCase());
  if (!article) notFound();
  return <ArticleView library={library} article={article} role={helpRole(actor.role)} />;
}
