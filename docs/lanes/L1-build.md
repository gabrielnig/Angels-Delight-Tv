# Lane L1 build notes (module M40, guest access)

Plan: `docs/plan/v2/L1-guest-access.md`. Rulings: `docs/plan/v2/RULINGS.md` (they win). Review: `docs/reviews/v2/L1-review.md`. Worktree: `/home/claude/wt2/L1-build`. Branch per slice `l1/sN-...`.

## Slices

| # | Slice | State | PR |
|---|---|---|---|
| 1 | Guest identity and guest playback token | merged | #221 |
| 2 | Watch page, local progress, analytics identity | merged | #227 |
| 3 | Account free catalog path and public GETs | on PR | see below |
| 4 | Guest chrome, title and series, Sign in to save | todo | |
| 5 | Home, Browse, Search for guests | todo | |
| 6 | Guest audience, Kids mode, settings | todo | |
| 7 | My List explainer, return intent | todo | |
| 8 | Guest Continue learning | todo | |
| 9 | History import | todo | |
| 10 | Abuse protection, Turnstile escalation | todo | |
| 11 | Robots, journeys, documents | todo | |

## Slice 1 (guest identity and playback)

Exists:
- `apps/web/src/server/guest/guest-cookie.ts`: `guestCookieName(secure)`, `guestCookieOptions(secure)`, `newGuestId()`, `signGuest`, `readGuest(secret, value)` (id or null), `guestSetCookie(secret, secure, id)` (the header value).
- `apps/web/src/server/guest/resolve-guest.ts`: `resolveGuest(request, { secret, secure, mint })` returns `{ guestId, isNew }` or null. The secret is `activeProfileKey(PLAYBACK_TOKEN_SECRET)`.
- `@ad/video` `playback-token.ts`: claims `gst` and `kd`, `IssueInput.guest` and `.kids`.
- `@ad/video` `PlaybackService.startGuestSession({ guestId, kids, ip? }, videoId)`, `GUEST_SEGMENT_URL_SECONDS`, policies `sessionGuest` (20 per minute) and `sessionGuestIp` (120 per minute), dep `guestSegmentTtlSeconds` (number or async function).
- `createPlaybackHandlers` deps `getGuest(request, { mint })` and `guestPlayEnabled()`. An account session always wins. Guest play off or no guest deps gives 401. Same origin check runs before the cookie is read.
- `VideoRuntime.guest` in `apps/web/src/server/video/api.ts`, wired in `runtime.ts` from settings `features.guest_play` and `limits.guest_segment_minutes`.
- Settings keys `features.guest_play` and `limits.guest_segment_minutes` in `packages/theme/src/settings-registry.ts`.

Plan corrections: none needed for slice 1. The Kids mode flag `kids` is false until slice 6 wires the audience.

Scoped tests:
`pnpm vitest run apps/web/src/server/guest/guest-cookie.test.ts packages/video/src/playback-token.test.ts packages/video/src/playback/service.test.ts packages/video/src/playback/http.test.ts packages/theme/src/settings-registry.test.ts apps/edge/src/handler.test.ts`
and (DB) `apps/web/src/server/video/api.int.test.ts`.

## Slice 2 (watch page for guests)

Exists:
- `packages/viewer/src/guest.ts`: `guestTitleDetail(ctx, { kids }, input)`, the account free title and series lookup (plain transaction, no `withAccount`, no personal table). `annotateCards`, `seriesPlayTarget` and `buildSeasons` now accept a null profile id (no progress, `inMyList` false). Slice 3 adds the other guest functions to this file.
- `ViewerContext.guest` on the Watch page (`apps/web/src/lib/data/playback.ts`) and `ProgressTransport` (`'http' | 'fixture' | 'local'`). `getViewerContext` returns `{ profileId: 'none', kids: false, guest: true }` for a missing session when `features.guest_play` is on (`apps/web/src/server/guest/guest-settings.ts`). Guest play off keeps the sign in redirect with `next`. `getProgressTransport(viewer)` returns `local` for guests.
- `RealPlaybackData.getWatchData` guest branch (published only, `kids-blocked` for a Kids mode guest on a non kids video, default preferences, `saved: null`).
- `apps/web/src/lib/guest/progress-store.ts`: `readGuestProgress`, `listGuestProgress`, `writeGuestProgress`, `removeGuestProgress`, `clearGuestProgress`, `createGuestProgressSink`, `GUEST_PROGRESS_KEY`, `GUEST_PROGRESS_CAP`. Never throws.
- `WatchClient` guest branch (no profile id in the session body, guest sink, resume from the store, no `prefsSync`, unsaved note). The page passes no `prefsSync` for guests.
- `createHttpSessionProvider` takes an optional `profileId` (the one `@ad/player` change, L4 should keep it).
- Analytics: `ViewerContext.subjectId` and `IngestContext.subjectId`, hashed as `guest:<id>` with the day. `createRealViewerResolver` returns it for a valid guest cookie.
- `robots: { index: false, follow: false }` on watch pages.
- Message key `guest.progress.notSaved` in `packages/shared/src/messages/en-ng.ts`.

Kids mode for guests is still false in `getViewerContext` and in the analytics resolver. Slice 6 wires the device choice into both, into `getGuest` in `apps/web/src/server/video/runtime.ts` and into the session mint.

Scoped tests:
`pnpm vitest run packages/viewer/src/guest.int.test.ts apps/web/src/lib/guest/progress-store.test.ts apps/web/src/lib/data/playback.server.test.ts apps/web/src/server/data/real-playback.int.test.ts packages/player/src/http.test.ts apps/web/src/features/player/WatchClient.guest.test.tsx apps/web/src/server/viewer/analytics-identity.guest.test.ts packages/analytics/src/ingest.test.ts "apps/web/src/app/watch/[videoId]/page.test.tsx"`

Decision numbers (the numbers that landed on main): guest access rule D-194, cookie D-195, token claims D-196, segment urls and limits D-197, progress store D-201, analytics identity D-202, guest catalog path D-203, public GETs D-204. (PR 227 text says D-198 and D-199 by mistake: another lane took 198 to 200 before the rebase.)

## Slice 3 (account free catalog path and public GETs)

Exists:
- `packages/viewer/src/guest.ts`: `guestTitleDetail`, `guestBrowse`, `guestCategories`, `guestSearch`, `guestSuggest`, `guestPopular`, `guestTitlesByIds` (max `GUEST_BATCH_MAX` = 20), `guestHome` (alias of `getGuestHome` in `home.ts`). Internals shared with the account path: `buildHome`, `browseFor`, `categoriesFor`, `searchFor`. A null profile id means no personal annotation.
- `packages/viewer/src/schemas.ts`: `guestHomeQuery`, `guestBrowseQuery`, `guestSearchQuery`, `guestSuggestQuery`, `guestTitleQuery`, `titlesBatchQuery`.
- `apps/web/src/server/viewer/public-api.ts`: `createPublicGuard(deps)(personal, guest, { search? })`. Wired in `api.ts` as `publicGet` for `home`, `browse`, `categories`, `search`, `suggest`, `title` and the new `titlesBatch` (`apps/web/src/app/api/titles/batch/route.ts`). `ViewerRuntime` has optional `guestAudience(request)` and `clientIp(request)`, wired in `server/viewer/runtime.ts`.
- `apps/web/src/server/guest/guest-audience.ts`: `resolveGuestAudience(cookie, siteDefault)`, cookie `__Host-ad_gaud` (`k` or `g`, unsigned), `readGuestAudienceCookie`. Setting `features.guest_audience` (enum, default general, admin tier) is in the registry. `guest-view.ts`: `currentGuestAudience()` for page renders. The setter action and toggle come in slice 6.
- `apps/web/src/lib/session.ts`: `getViewerOrGuest(next)` returns `{ kind: 'account', ...ViewerState }` or `{ kind: 'guest', ctx }`. A missing session is a guest and never a redirect. Unverified, no profile and pending deletion keep their redirects.
- `apps/web/src/lib/data/types.ts`: `ViewerContext.guest?: true` and `guestContext(audience)`. `RealCatalog` branches on `ctx.guest` for home, homeRows, categories, browse, search, suggest, popular and title/series. `apps/web/src/lib/data/guest-library.ts`: `guestLibrary`.

Plan corrections: the `GuestViewerContext` union became an optional flag (D-203). `profileId` is not optional on the personal schemas, the guest path has its own schemas. Two existing tests that expected 401 from `/api/home` for no session were moved to a personal route (`api.progress.get`), because home is public now. `apps/web/e2e/viewer-real.e2e.ts` stranger test updated (personal 401, home 200 with no list state). The browse redirect e2e is updated in slice 5.

Known gap: the admin Settings form (`SiteSettingsView.tsx`) lists keys by hand. `features.guest_play`, `features.guest_audience` and `limits.guest_segment_minutes` are added there in slice 6.

Scoped tests:
`pnpm vitest run packages/viewer/src/guest.int.test.ts apps/web/src/server/viewer/public-api.test.ts apps/web/src/server/viewer/route-matrix.int.test.ts apps/web/src/server/data/real-catalog.int.test.ts apps/web/src/lib/session.test.ts apps/web/src/lib/data/guest-library.test.ts apps/web/src/server/guest/guest-audience.test.ts`
