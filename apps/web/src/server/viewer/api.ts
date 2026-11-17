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
import { z } from 'zod';
import { errorResponse, json, parseWith, queryObject, readJson } from './http';

/** The player's progress sink shape (`ProgressUpdate` in @ad/player): seconds, not milliseconds. */
const watchProgressBody = z.object({
  videoId: saveProgressBody.shape.videoId,
  profileId: saveProgressBody.shape.profileId,
  positionSeconds: z.number().finite().min(0).max(86_400),
  durationSeconds: z.number().finite().min(0).max(86_400 * 7).optional(),
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
}

type Handler = (
  request: Request,
  actor: Actor,
  params: Record<string, string>,
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

  function activeProfileOf(request: Request, actor: Actor): string | null {
    return readActiveProfile(
      rt.profileSecret,
      actor.accountId,
      cookieValue(request.headers.get('cookie'), cookieName),
    );
  }

  /** Same origin check for anything that changes state, then sign in, then the handler. Errors become JSON. */
  function guard(handler: Handler, options: { mutating?: boolean } = {}) {
    return async (request: Request, params: Record<string, string> = {}): Promise<Response> => {
      try {
        if (options.mutating) {
          const origin = request.headers.get('origin');
          if (origin !== null && origin !== rt.appOrigin)
            throw new Forbidden('Cross-origin request refused');
          if (origin === null && request.headers.get('sec-fetch-site') === 'cross-site') {
            throw new Forbidden('Cross-origin request refused');
          }
        }
        const actor = await rt.resolveActor(request);
        if (!actor) throw new Unauthorized();
        return await handler(request, actor, params);
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
        async (req, actor) => {
          const body = parseWith(createProfileBody, await readJson(req));
          const profile = await createProfile(rt.ctx, actor, body, {
            activeProfileId: activeProfileOf(req, actor),
          });
          return json({ profile }, { status: 201 });
        },
        { mutating: true },
      ),
      update: guard(
        async (req, actor, params) => {
          const { password, expectedUpdatedAt, ...input } = parseWith(
            updateProfileBody,
            await readJson(req),
          );
          const profile = await updateProfile(rt.ctx, actor, idParam(params), input, {
            activeProfileId: activeProfileOf(req, actor),
            password,
            expectedUpdatedAt,
          });
          return json({ profile });
        },
        { mutating: true },
      ),
      remove: guard(
        async (req, actor, params) => {
          await deleteProfile(rt.ctx, actor, idParam(params), {
            activeProfileId: activeProfileOf(req, actor),
          });
          return json({ ok: true });
        },
        { mutating: true },
      ),
      select: guard(
        async (req, actor, params) => {
          const { pin } = parseWith(selectProfileBody, await readJson(req));
          const profile = await selectProfile(rt.ctx, actor, idParam(params), { pin });
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
        async (req, actor) => {
          const body = parseWith(exitKidsBody, await readJson(req));
          await exitKidsMode(rt.ctx, actor, body);
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
