import { catalogCache } from '@ad/catalog';
import 'server-only';
import { PasswordHasher, maskEmail } from '@ad/auth';
import { sealViewerAddress } from '@ad/queue';
import { accounts, withAccount } from '@ad/db';
import { type BucketPolicy } from '@ad/security';
import { readSetting } from '@ad/theme';
import { VIEWER_RATE_POLICIES, type NameCipher, type ViewerContext, type ViewerRules } from '@ad/viewer';
import { hmacSha256, type Actor } from '@ad/shared';
import { eq } from 'drizzle-orm';
import { getServices } from '../../lib/runtime/services';
import { authRuntime } from '../auth/runtime';
import { cookieValue } from './active-profile';
import { sessionCookieName } from '../auth/cookies';
import { viewerActorFor } from './runtime-actor';
import { clientIp } from '@ad/security';
import { themeRuntime } from '../../lib/data/admin/theme-runtime';
import { readGuestAudienceCookie, resolveGuestAudience } from '../guest/guest-audience';
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

/** Settings backed rules, read at most once a minute per process. */
function settingsRules(db: Parameters<typeof readSetting>[0]): () => Promise<Partial<ViewerRules>> {
  let memo: { at: number; value: Partial<ViewerRules> } | null = null;
  return async () => {
    if (memo && Date.now() - memo.at < 60_000) return memo.value;
    const [minTitles, minPlays, maxAge, topTen, window, minViews, minPopular] = await Promise.all([
      readSetting(db, 'trending.min_titles'),
      readSetting(db, 'trending.min_site_plays'),
      readSetting(db, 'trending.max_age_hours'),
      readSetting(db, 'trending.top_ten_size'),
      readSetting(db, 'trending.popular_window_days'),
      readSetting(db, 'trending.popular_min_views'),
      readSetting(db, 'trending.popular_min_titles'),
    ]);
    const value: Partial<ViewerRules> = {
      trendingMinTitles: minTitles,
      trendingMinSitePlays: minPlays,
      trendingMaxAgeHours: maxAge,
      topTenSize: topTen,
      popularWindowDays: window,
      popularMinViews: minViews,
      popularMinTitles: minPopular,
    };
    memo = { at: Date.now(), value };
    return value;
  };
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
    catalogCache,
    loadRules: settingsRules(services.db),
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
    async sealAddress(actor) {
      try {
        const info = await auth.staff.getOverview({
          accountId: actor.accountId,
          role: 'viewer',
          sessionId: '',
        });
        return {
          sealed: sealViewerAddress(services.env.FIELD_KEK, actor.accountId, info.email),
          masked: maskEmail(info.email),
        };
      } catch {
        return null;
      }
    },
    async guestAudience(request) {
      const settings = (await themeRuntime()).settings;
      const siteDefault = await settings.get('features.guest_audience');
      const choice = readGuestAudienceCookie(request, auth.secureCookies);
      const kids = resolveGuestAudience(choice, siteDefault) === 'kids';
      return { kids, maxRank: kids ? 0 : await settings.get('maturity.guest_max_rank') };
    },
    // Without a trusted proxy there is no reliable address, so everyone shares one bucket. Production sets
    // TRUSTED_PROXY_MODE=cloudflare.
    clientIp: (request) =>
      clientIp(request.headers, services.env.TRUSTED_PROXY_MODE) ?? 'untrusted',
    async resolveActor(request) {
      const token = cookieValue(
        request.headers.get('cookie'),
        sessionCookieName(auth.secureCookies),
      );
      if (!token) return null;
      const session = await auth.sessions.validate(token);
      if (!session || session.status !== 'active' || !session.emailVerified) return null;
      return viewerActorFor(session);
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
