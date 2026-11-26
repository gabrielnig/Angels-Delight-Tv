import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ArticleView } from '@/components/admin/help/ArticleView';
import { helpMediaIsSample } from '@/server/help/sources';
import { HelpVideo } from '@/components/admin/help/HelpVideo';
import { videoCues } from '@/server/help/video-block';
import { ArticleActions } from '@/components/admin/help/ArticleActions';
import { helpProgress, type ProgressRows } from '@/lib/data/admin/help-progress';
import { requireActor } from '@/lib/data/admin/session-next';
import { getLibrary, helpRole } from '@/server/help';
import { markVideoWatchedAction, setGuideDoneAction, setHelpfulAction } from '../actions';

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
  const rows: ProgressRows = await helpProgress.read(actor).catch(() => ({}));
  const mine = rows[article.meta.id];
  return (
    <ArticleView
      library={library}
      article={article}
      role={helpRole(actor.role)}
      video={
        article.meta.video ? (
          <HelpVideo
            guide={article.meta.id}
            videoId={article.meta.video.id}
            title={article.meta.title}
            phone={article.meta.video.phone}
            captions={article.meta.video.captions}
            cues={await videoCues(article)}
            watched={mine?.watched ?? false}
            sample={helpMediaIsSample()}
            onWatched={markVideoWatchedAction}
          />
        ) : undefined
      }
      actions={
        <ArticleActions
          guide={article.meta.id}
          initial={{ done: mine?.done ?? false, helpful: mine?.helpful ?? null }}
          setDone={setGuideDoneAction}
          setHelpful={setHelpfulAction}
        />
      }
    />
  );
}
