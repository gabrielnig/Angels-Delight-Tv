import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { helpMediaIsSample } from '@/server/help/sources';
import { HelpVideo } from '@/components/admin/help/HelpVideo';
import { Playlist } from '@/components/admin/help/Playlist';
import { PageHeader } from '@/components/admin/PageHeader';
import { LinkButton } from '@/components/admin/Button';
import { articleHref } from '@/lib/admin/help-map';
import { helpProgress, type ProgressRows } from '@/lib/data/admin/help-progress';
import { requireActor } from '@/lib/data/admin/session-next';
import { getLibrary, helpRole } from '@/server/help';
import { videoCues } from '@/server/help/video-block';
import { splitByRole } from '@ad/help';
import { markVideoWatchedAction } from '../../actions';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const a = getLibrary().byId.get(id.toUpperCase());
  return { title: a ? `${a.meta.title}, video` : 'Help centre' };
}

/** The video page: the player, the transcript and the playlist for the path (M50-S06). Not a catalog title. */
export default async function HelpVideoPage({ params }: Props) {
  const { id } = await params;
  const actor = await requireActor(`/admin/help/videos/${id}`);
  const library = getLibrary();
  const article = library.byId.get(id.toUpperCase());
  if (!article?.meta.video) notFound();
  const path = library.paths.find((p) => p.key === article.meta.path);
  const rows: ProgressRows = await helpProgress.read(actor).catch(() => ({}));
  const visible = splitByRole(path?.articles ?? [], helpRole(actor.role), {
    showAll: true,
  }).visible;
  return (
    <div className="hlp-watch">
      <PageHeader
        crumbs={[
          { label: 'Admin', href: '/admin' },
          { label: 'Help centre', href: '/admin/help' },
          ...(path ? [{ label: path.title, href: `/admin/help/path/${path.key}` }] : []),
          { label: article.meta.title },
        ]}
        title={article.meta.title}
        lead="A short silent video with captions."
        actions={
          <LinkButton href={articleHref(article.meta.id)} icon="book">
            Read the guide
          </LinkButton>
        }
      />
      <div className="hlp-watch__grid">
        <HelpVideo
          guide={article.meta.id}
          videoId={article.meta.video.id}
          title={article.meta.title}
          phone={article.meta.video.phone}
          captions={article.meta.video.captions}
          cues={await videoCues(article)}
          watched={rows[article.meta.id]?.watched ?? false}
          sample={helpMediaIsSample()}
          onWatched={markVideoWatchedAction}
        />
        <Playlist
          title={path?.title ?? 'Videos'}
          articles={visible}
          currentId={article.meta.id}
          progress={rows}
        />
      </div>
    </div>
  );
}
