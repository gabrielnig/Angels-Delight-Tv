import '@ad/player/player.css';
import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import { getPlaybackData, getViewerContext, getTransport } from '@/lib/data/playback.server';
import { BROWSE_PATH, HOME_PATH } from '@/features/player/routes';
import { parseStartAt } from '@/features/player/start-at';
import { UpNextList } from '@/features/player/UpNextList';
import { WatchClient } from '@/features/player/WatchClient';
import { WatchDetails } from '@/features/player/WatchDetails';
import '@/features/player/watch.css';

interface PageProps {
  params: Promise<{ videoId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { videoId } = await params;
  const viewer = await getViewerContext(await cookies());
  const lookup = await getPlaybackData().getWatchData(videoId, viewer);
  return { title: lookup.status === 'ok' ? lookup.data.video.title : 'Watch' };
}

export default async function WatchPage({ params, searchParams }: PageProps) {
  const [{ videoId }, query] = await Promise.all([params, searchParams]);
  const viewer = await getViewerContext(await cookies());
  const lookup = await getPlaybackData().getWatchData(videoId, viewer);

  if (lookup.status === 'not-found') notFound();
  if (lookup.status === 'kids-blocked') {
    return (
      <main className="watch__message">
        <h1>This video is not available on a kids profile</h1>
        <p>Ask a grown up to switch profiles, or pick something else to watch.</p>
        <div className="watch__message-actions">
          <a className="watch__button" href={HOME_PATH}>
            Back to Home
          </a>
          <a className="watch__button" href={BROWSE_PATH}>
            Browse videos
          </a>
        </div>
      </main>
    );
  }

  const { data } = lookup;
  return (
    <main className="watch">
      <div className="watch__main">
        <a className="watch__back" href={data.video.backHref}>
          {'← Back'}
        </a>
        <WatchClient
          data={data}
          viewer={viewer}
          transport={getTransport()}
          startAt={parseStartAt(query.t)}
        >
          <WatchDetails data={data} />
        </WatchClient>
      </div>
      <UpNextList tiles={data.upNext} />
    </main>
  );
}
