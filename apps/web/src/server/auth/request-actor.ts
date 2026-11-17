import 'server-only';
import { activeProfileKey } from '../viewer/runtime';
import { createRequestAuth, type RequestAuth } from './request-auth';
import { authRuntime } from './runtime';

let cached: RequestAuth | undefined;

function requestAuth(): RequestAuth {
  if (!cached) {
    const runtime = authRuntime();
    cached = createRequestAuth({
      sessions: runtime.sessions,
      secureCookies: runtime.secureCookies,
      profileSecret: activeProfileKey(runtime.env.PLAYBACK_TOKEN_SECRET),
    });
  }
  return cached;
}

/** The signed in editor or admin for a route handler. Throws Unauthorized or Forbidden. */
export const getActor = (request: Request) => requestAuth().getActor(request);

/** The signed in viewer and active profile hint for a route handler. Throws Unauthorized. */
export const getViewer = (request: Request) => requestAuth().getViewer(request);
