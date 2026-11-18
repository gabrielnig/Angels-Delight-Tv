import { Player, createHttpSessionProvider } from '@ad/player';
import { createRoot } from 'react-dom/client';

/** Browser entry for the real stack E2E: the real Player and hls.js against the real playback routes. */
interface Cfg {
  videoId: string;
  profileId: string;
  appOrigin: string;
}

const cfg = (window as unknown as { __HLS_CFG: Cfg }).__HLS_CFG;
const progress: Array<Record<string, unknown>> = [];
(window as unknown as { __progress: typeof progress }).__progress = progress;

createRoot(document.getElementById('root') as HTMLElement).render(
  <Player
    videoId={cfg.videoId}
    profileId={cfg.profileId}
    title="Real stack"
    appOrigin={cfg.appOrigin}
    sessionProvider={createHttpSessionProvider({
      appOrigin: cfg.appOrigin,
      profileId: cfg.profileId,
    })}
    progressSink={{
      save: async (update) => {
        progress.push({ ...update });
      },
    }}
    onSignIn={() => {
      (window as unknown as { __signIn?: boolean }).__signIn = true;
    }}
  />,
);
