import '@ad/player/player.css';
import { migrateDevicePrefsAction, savePlayerPrefsAction } from '@/app/actions';
import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import {
  getPlaybackData,
  getProgressTransport,
  getTransport,
  getViewerContext,
} from '@/lib/data/playback.server';
import { BROWSE_PATH, HOME_PATH } from '@/features/player/routes';
import { parseStartAt } from '@/features/player/start-at';
import { UpNextList } from '@/features/player/UpNextList';
import { WatchClient } from '@/features/player/WatchClient';
import { WatchDetails } from '@/features/player/WatchDetails';
import '@/features/player/watch.css';
import { getSite } from '@/lib/data';
import { turnstileSiteKey } from '@/server/auth/turnstile-site';
import { playerCountdownSeconds } from '@/server/player/player-settings';

interface PageProps {
  params: Promise<{ videoId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { videoId } = await params;
  const viewer = await getViewerContext(await cookies());
  const lookup = await getPlaybackData().getWatchData(videoId, viewer);
  // The title page is the canonical page. A watch page is never indexed (M40-S17).
  return {
    title: lookup.status === 'ok' ? lookup.data.video.title : 'Watch',
    robots: { index: false, follow: false },
  };
}

export default async function WatchPage({ params, searchParams }: PageProps) {
  const [{ videoId }, query] = await Promise.all([params, searchParams]);
  const viewer = await getViewerContext(await cookies(), `/watch/${videoId}`);
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
          challengeSiteKey={viewer.guest && !viewer.kids ? turnstileSiteKey() : undefined}
          signUpOpen={viewer.guest ? (await getSite().content()).signUpOpen : undefined}
          transport={getTransport()}
          progressTransport={getProgressTransport(viewer)}
          startAt={parseStartAt(query.t)}
          countdownSeconds={await playerCountdownSeconds()}
          {...(viewer.guest
            ? {}
            : { prefsSync: { save: savePlayerPrefsAction, migrate: migrateDevicePrefsAction } })}
        >
          <WatchDetails data={data} />
        </WatchClient>
      </div>
      <UpNextList tiles={data.upNext} />
    </main>
  );
}
