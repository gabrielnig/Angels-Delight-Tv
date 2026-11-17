import 'server-only';
import { activeProfileKey } from '../viewer/runtime';
import { createRequestAuth, type RequestAuth } from './request-auth';
import { createAdminBudget } from '../admin/budget';
import { authRuntime } from './runtime';

/** The per staff admin limit, shared with server actions through `spendAdminBudget`. */
export function adminBudget() {
  return createAdminBudget((policy, subject) => authRuntime().limiter.consume(policy, subject));
}

let cached: RequestAuth | undefined;

function requestAuth(): RequestAuth {
  if (!cached) {
    const runtime = authRuntime();
    cached = createRequestAuth({
      sessions: runtime.sessions,
      secureCookies: runtime.secureCookies,
      profileSecret: activeProfileKey(runtime.env.PLAYBACK_TOKEN_SECRET),
      beforeStaff: (accountId) => adminBudget().spend(accountId),
    });
  }
  return cached;
}

/** The signed in editor or admin for a route handler. Throws Unauthorized or Forbidden. */
export const getActor = (request: Request) => requestAuth().getActor(request);

/** The signed in viewer and active profile hint for a route handler. Throws Unauthorized. */
export const getViewer = (request: Request) => requestAuth().getViewer(request);
