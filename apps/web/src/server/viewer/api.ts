import {
  addToMyList,
  browse,
  clearRecentSearches,
  continueWatching,
  createProfile,
  deleteProfile,
  exitKidsMode,
  getHome,
  getProgress,
  getRecentSearches,
  getTitleDetail,
  listBrowseCategories,
  listMyList,
  listProfiles,
  removeFromMyList,
  removeProgress,
  removeRecentSearch,
  saveProgress,
  search,
  selectProfile,
  suggest,
  updateProfile,
  spendAttempt,
  type ViewerContext,
} from '@ad/viewer';
import {
  browseQuery,
  createProfileBody,
  exitKidsBody,
  homeQuery,
  myListAddBody,
  myListQuery,
  myListRemoveBody,
  profileIdQuery,
  progressQuery,
  recentSearchDelete,
  removeProgressBody,
  saveProgressBody,
  searchQuery,
  selectProfileBody,
  suggestQuery,
  titleDetailQuery,
  updateProfileBody,
} from '@ad/viewer/schemas';
import { Forbidden, NotFound, Unauthorized, isUuid, type Actor } from '@ad/shared';
import {
  activeProfileCookieName,
  activeProfileCookieOptions,
  cookieValue,
  readActiveProfile,
  signActiveProfile,
} from './active-profile';
import { assertSameOrigin } from '@ad/security';
import { z } from 'zod';
import { errorResponse, json, parseWith, queryObject, readJson } from './http';

/** The player's progress sink shape (`ProgressUpdate` in @ad/player): seconds, not milliseconds. */
const watchProgressBody = z.object({
  videoId: saveProgressBody.shape.videoId,
  profileId: saveProgressBody.shape.profileId,
  positionSeconds: z.number().finite().min(0).max(86_400),
  durationSeconds: z
    .number()
    .finite()
    .min(0)
    .max(86_400 * 7)
    .optional(),
  ended: z.boolean().optional(),
});

/** Everything the viewer routes need from the outside. Production wiring is in runtime.ts, tests pass their own. */
export interface ViewerRuntime {
  ctx: ViewerContext;
  appOrigin: string;
  secureCookies: boolean;
  /** Key for the active profile cookie. */
  profileSecret: Uint8Array;
  /** The signed in account for this request, or null. Staff browsing as viewers are included. */
  resolveActor(request: Request): Promise<Actor | null>;
  /** The kids lock on the session row. Server side state, so no cookie can change it. */
  lock: KidsLockStore;
}

export interface KidsLock {
  sessionId: string;
  profileId: string | null;
  kidsLocked: boolean;
}

export interface KidsLockStore {
  read(request: Request): Promise<KidsLock | null>;
  set(sessionId: string, accountId: string, profileId: string, kidsLocked: boolean): Promise<void>;
  clear(sessionId: string, accountId: string): Promise<void>;
}

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

type Handler = (
  request: Request,
  actor: Actor,
  params: Record<string, string>,
  lock: KidsLock,
) => Promise<Response>;

function serialize(
  name: string,
  value: string,
  options: ReturnType<typeof activeProfileCookieOptions>,
  clear = false,
) {
  const parts = [`${name}=${clear ? '' : value}`, 'Path=/', 'HttpOnly', 'SameSite=Lax'];
  if (options.secure) parts.push('Secure');
  parts.push(`Max-Age=${clear ? 0 : options.maxAge}`);
  return parts.join('; ');
}

export function createViewerApi(rt: ViewerRuntime) {
  const cookieName = activeProfileCookieName(rt.secureCookies);

  /** The profile in use. A kids lock on the session wins over the cookie, which is only a hint. */
  function activeProfileOf(request: Request, actor: Actor, lock: KidsLock): string | null {
    if (lock.kidsLocked) return lock.profileId;
    return readActiveProfile(
      rt.profileSecret,
      actor.accountId,
      cookieValue(request.headers.get('cookie'), cookieName),
    );
  }

  /** The profile id a request names, in the query or the JSON body. Checked against the lock before any handler. */
  async function claimedProfile(request: Request): Promise<string | undefined> {
    const fromQuery = new URL(request.url).searchParams.get('profileId');
    if (fromQuery) return fromQuery;
    if (request.method === 'GET' || request.method === 'HEAD') return undefined;
    try {
      const text = await request.clone().text();
      if (text.length > 16_384) return undefined;
      const value = (JSON.parse(text) as { profileId?: unknown }).profileId;
      return typeof value === 'string' ? value : undefined;
    } catch {
      return undefined;
    }
  }

  /** Same origin check for anything that changes state, then sign in, then the handler. Errors become JSON. */
  function guard(handler: Handler, options: { mutating?: boolean } = {}) {
    return async (request: Request, params: Record<string, string> = {}): Promise<Response> => {
      try {
        // Strict check for every method that is not safe, whatever the route says (L-14).
        if (options.mutating || !SAFE_METHODS.has(request.method.toUpperCase())) {
          assertSameOrigin(request.headers, rt.appOrigin);
        }
        const actor = await rt.resolveActor(request);
        if (!actor) throw new Unauthorized();
        await spendAttempt(rt.ctx, 'api', actor.accountId);
        const lock = (await rt.lock.read(request)) ?? {
          sessionId: '',
          profileId: null,
          kidsLocked: false,
        };
        if (lock.kidsLocked) {
          const claimed = await claimedProfile(request);
          if (claimed !== undefined && claimed !== lock.profileId) throw new Forbidden('kids_gate');
        }
        return await handler(request, actor, params, lock);
      } catch (error) {
        const mapped = errorResponse(error);
        if (mapped) return mapped;
        throw error;
      }
    };
  }

  const idParam = (params: Record<string, string>): string => {
    const value = params.id ?? '';
    if (!isUuid(value)) throw new NotFound('Not found');
    return value;
  };

  return {
    profiles: {
      list: guard(async (_req, actor) => json({ profiles: await listProfiles(rt.ctx, actor) })),
      create: guard(
        async (req, actor, _params, lock) => {
          const body = parseWith(createProfileBody, await readJson(req));
          const profile = await createProfile(rt.ctx, actor, body, {
            activeProfileId: activeProfileOf(req, actor, lock),
          });
          return json({ profile }, { status: 201 });
        },
        { mutating: true },
      ),
      update: guard(
        async (req, actor, params, lock) => {
          const { password, expectedUpdatedAt, ...input } = parseWith(
            updateProfileBody,
            await readJson(req),
          );
          const profile = await updateProfile(rt.ctx, actor, idParam(params), input, {
            activeProfileId: activeProfileOf(req, actor, lock),
            password,
            expectedUpdatedAt,
          });
          return json({ profile });
        },
        { mutating: true },
      ),
      remove: guard(
        async (req, actor, params, lock) => {
          await deleteProfile(rt.ctx, actor, idParam(params), {
            activeProfileId: activeProfileOf(req, actor, lock),
          });
          return json({ ok: true });
        },
        { mutating: true },
      ),
      select: guard(
        async (req, actor, params, lock) => {
          const { pin } = parseWith(selectProfileBody, await readJson(req));
          const profile = await selectProfile(rt.ctx, actor, idParam(params), {
            pin,
            kidsLocked: lock.kidsLocked,
          });
          if (lock.sessionId)
            await rt.lock.set(lock.sessionId, actor.accountId, profile.id, profile.isKids);
          const cookie = serialize(
            cookieName,
            signActiveProfile(rt.profileSecret, actor.accountId, profile.id),
            activeProfileCookieOptions(rt.secureCookies),
          );
          return json({ profile }, { headers: { 'Set-Cookie': cookie } });
        },
        { mutating: true },
      ),
      exitKids: guard(
        async (req, actor, _params, lock) => {
          const body = parseWith(exitKidsBody, await readJson(req));
          await exitKidsMode(rt.ctx, actor, body);
          if (lock.sessionId) await rt.lock.clear(lock.sessionId, actor.accountId);
          const cookie = serialize(
            cookieName,
            '',
            activeProfileCookieOptions(rt.secureCookies),
            true,
          );
          return json({ ok: true }, { headers: { 'Set-Cookie': cookie } });
        },
        { mutating: true },
      ),
    },

    home: guard(async (req, actor) => {
      const q = parseWith(homeQuery, queryObject(req));
      return json(await getHome(rt.ctx, actor, q));
    }),

    browse: guard(async (req, actor) => {
      const { category, ...q } = parseWith(browseQuery, queryObject(req));
      return json(await browse(rt.ctx, actor, { ...q, categorySlug: category }));
    }),
    categories: guard(async (req, actor) => {
      const q = parseWith(profileIdQuery, queryObject(req));
      return json({ categories: await listBrowseCategories(rt.ctx, actor, q) });
    }),

    search: guard(async (req, actor) => {
      const { q, ...rest } = parseWith(searchQuery, queryObject(req));
      return json(await search(rt.ctx, actor, { ...rest, query: q }));
    }),
    suggest: guard(async (req, actor) => {
      const { q, profileId } = parseWith(suggestQuery, queryObject(req));
      return json({ suggestions: await suggest(rt.ctx, actor, { profileId, query: q }) });
    }),
    recentSearches: {
      list: guard(async (req, actor) => {
        const q = parseWith(profileIdQuery, queryObject(req));
        return json({ queries: await getRecentSearches(rt.ctx, actor, q) });
      }),
      remove: guard(
        async (req, actor) => {
          const { profileId, q } = parseWith(recentSearchDelete, queryObject(req));
          if (q === undefined) await clearRecentSearches(rt.ctx, actor, { profileId });
          else await removeRecentSearch(rt.ctx, actor, { profileId, query: q });
          return json({ ok: true });
        },
        { mutating: true },
      ),
    },

    title: guard(async (req, actor, params) => {
      const q = parseWith(titleDetailQuery, queryObject(req));
      const key = params.id ?? '';
      const input = isUuid(key) ? { id: key } : { slug: key };
      return json(await getTitleDetail(rt.ctx, actor, { ...q, ...input }));
    }),

    progress: {
      get: guard(async (req, actor) => {
        const q = parseWith(progressQuery, queryObject(req));
        if (q.videoId) {
          return json({
            progress: await getProgress(rt.ctx, actor, {
              profileId: q.profileId,
              videoId: q.videoId,
            }),
          });
        }
        return json({ items: await continueWatching(rt.ctx, actor, { profileId: q.profileId }) });
      }),
      save: guard(
        async (req, actor) => {
          const body = parseWith(saveProgressBody, await readJson(req));
          return json({ progress: await saveProgress(rt.ctx, actor, body) });
        },
        { mutating: true },
      ),
      remove: guard(
        async (req, actor) => {
          const body = parseWith(removeProgressBody, await readJson(req));
          await removeProgress(rt.ctx, actor, body);
          return json({ ok: true });
        },
        { mutating: true },
      ),
    },

    /** POST /api/watch/progress, the route the player's HTTP sink and sendBeacon call. Same service as /api/progress. */
    watchProgress: guard(
      async (req, actor) => {
        const body = parseWith(watchProgressBody, await readJson(req));
        const progress = await saveProgress(rt.ctx, actor, {
          profileId: body.profileId,
          videoId: body.videoId,
          positionMs: Math.round(body.positionSeconds * 1000),
          ended: body.ended === true ? true : undefined,
        });
        return json({ progress });
      },
      { mutating: true },
    ),

    myList: {
      list: guard(async (req, actor) => {
        const q = parseWith(myListQuery, queryObject(req));
        return json(await listMyList(rt.ctx, actor, q));
      }),
      add: guard(
        async (req, actor) => {
          const body = parseWith(myListAddBody, await readJson(req));
          return json(await addToMyList(rt.ctx, actor, body), { status: 201 });
        },
        { mutating: true },
      ),
      remove: guard(
        async (req, actor) => {
          const body = parseWith(myListRemoveBody, await readJson(req));
          return json(await removeFromMyList(rt.ctx, actor, body));
        },
        { mutating: true },
      ),
    },
  };
}

export type ViewerApi = ReturnType<typeof createViewerApi>;
