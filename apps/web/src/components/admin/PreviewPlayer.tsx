'use client';

import { Player, type CaptionTrack, type PlayerController, type ProgressSink } from '@ad/player';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { createPreviewSessionProvider } from '@/lib/admin/preview-session';
import { Banner } from './states';

const noProgress: ProgressSink = { save: async () => undefined };

/**
 * "Preview as viewer" (M16-S08): the real viewer player on a staff preview session. The session route only
 * answers a signed in staff member, so a shared link fails for anyone else. No viewer progress is written.
 */
export function PreviewPlayer({
  video,
  captions,
  backHref,
  onReady,
}: {
  video: { id: string; title: string; durationSeconds: number; posterUrl: string | null };
  captions: CaptionTrack[];
  backHref: string;
  /** Gives the editor the controller so it can read the time and seek (marker editor). */
  onReady?: (controller: PlayerController | null) => void;
}) {
  const [origin, setOrigin] = useState<string | null>(null);
  useEffect(() => setOrigin(window.location.origin), []);
  const sessionProvider = useMemo(
    () => (origin ? createPreviewSessionProvider({ appOrigin: origin }) : null),
    [origin],
  );
  return (
    <div className="adm-stack">
      <Banner tone="info">
        Only signed in staff can see this preview. It plays the video the way a viewer would see it,
        and nothing is saved to anyone's history.
      </Banner>
      <div className="adm-preview-player">
        {origin && sessionProvider ? (
          <Player
            videoId={video.id}
            profileId="preview"
            title={video.title}
            {...(video.posterUrl ? { posterUrl: video.posterUrl } : {})}
            appOrigin={origin}
            sessionProvider={sessionProvider}
            progressSink={noProgress}
            {...(onReady ? { onController: onReady } : {})}
            captions={captions}
            resume={{
              urlT: null,
              saved: null,
              finished: false,
              duration: video.durationSeconds,
            }}
            end={{
              backHref,
              backLabel: 'Back to the video',
              homeHref: backHref,
              browseHref: backHref,
              related: [],
              inMyList: false,
            }}
            links={{ signIn: '/admin/login', browse: backHref, help: backHref }}
          />
        ) : (
          <div className="adm-preview-player__wait" aria-hidden="true" />
        )}
      </div>
      <div>
        <Link className="adm-link" href={backHref}>
          Back to the video
        </Link>
      </div>
    </div>
  );
}
