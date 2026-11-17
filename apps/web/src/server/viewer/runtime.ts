import 'server-only';
import { PasswordHasher } from '@ad/auth';
import { accounts, withAccount } from '@ad/db';
import { type BucketPolicy } from '@ad/security';
import { VIEWER_RATE_POLICIES, type NameCipher, type ViewerContext } from '@ad/viewer';
import { hmacSha256, type Actor } from '@ad/shared';
import { eq } from 'drizzle-orm';
import { getServices } from '../../lib/runtime/services';
import { authRuntime } from '../auth/runtime';
import { cookieValue } from './active-profile';
import { sessionCookieName } from '../auth/cookies';
import { createViewerApi, type ViewerApi, type ViewerRuntime } from './api';

const NAME_COLUMN = 'profile_name';
const SECRET_LABEL = new TextEncoder().encode('ad:active-profile-key:v1');

/** Key for the active profile cookie. Other request level auth (video routes) must derive the same key. */
export function activeProfileKey(playbackTokenSecret: Uint8Array): Uint8Array {
  return hmacSha256(playbackTokenSecret, SECRET_LABEL);
}

function policyFor(bucket: keyof typeof VIEWER_RATE_POLICIES): BucketPolicy {
  const { capacity, windowSeconds } = VIEWER_RATE_POLICIES[bucket];
  return { name: `viewer_${bucket}`, capacity, refillPerSecond: capacity / windowSeconds };
}

/** Production wiring. Built once on first use, so importing a route never needs the environment. */
function build(): ViewerRuntime {
  const services = getServices();
  const auth = authRuntime();
  const hasher = new PasswordHasher();

  const nameCipher: NameCipher = {
    seal: (accountId, name) => auth.keys.seal(accountId, NAME_COLUMN, name),
    open: (accountId, sealed) => auth.keys.open(accountId, NAME_COLUMN, sealed),
  };

  const ctx: ViewerContext = {
    db: services.db,
    mediaOrigin: services.env.MEDIA_ORIGIN,
    nameCipher,
    async verifyPassword(accountId, password) {
      const actor: Actor = { accountId, role: 'viewer' };
      const [row] = await withAccount(services.db, actor, (tx) =>
        tx
          .select({ hash: accounts.passwordHash })
          .from(accounts)
          .where(eq(accounts.id, accountId))
          .limit(1),
      );
      return row?.hash ? hasher.verify(row.hash, password) : hasher.verifyDummy(password);
    },
    async rateLimit(bucket, subject) {
      const result = await auth.limiter.consume(policyFor(bucket), subject);
      return { allowed: result.allowed, retryAfterSeconds: result.retryAfterSeconds };
    },
  };

  return {
    ctx,
    appOrigin: services.env.APP_ORIGIN,
    secureCookies: auth.secureCookies,
    profileSecret: activeProfileKey(services.env.PLAYBACK_TOKEN_SECRET),
    lock: {
      async read(request) {
        const token = cookieValue(
          request.headers.get('cookie'),
          sessionCookieName(auth.secureCookies),
        );
        const session = token ? await auth.sessions.validate(token) : null;
        return session
          ? {
              sessionId: session.sessionId,
              profileId: session.activeProfileId,
              kidsLocked: session.kidsLocked,
            }
          : null;
      },
      set: (sessionId, accountId, profileId, kidsLocked) =>
        auth.sessions.setProfile(sessionId, accountId, profileId, kidsLocked),
      clear: (sessionId, accountId) => auth.sessions.clearKidsLock(sessionId, accountId),
    },
    async resolveActor(request) {
      const token = cookieValue(
        request.headers.get('cookie'),
        sessionCookieName(auth.secureCookies),
      );
      if (!token) return null;
      const session = await auth.sessions.validate(token);
      if (!session || session.status !== 'active' || !session.emailVerified) return null;
      return { accountId: session.accountId, role: session.role };
    },
  };
}

let runtime: ViewerRuntime | undefined;
let cached: ViewerApi | undefined;

/** The wiring shared by the routes and the server side data layer (lib/data). Built once, on first use. */
export function viewerRuntime(): ViewerRuntime {
  runtime ??= build();
  return runtime;
}

export function viewerApi(): ViewerApi {
  cached ??= createViewerApi(viewerRuntime());
  return cached;
}
