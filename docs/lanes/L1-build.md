# Lane L1 build notes (module M40, guest access)

Plan: `docs/plan/v2/L1-guest-access.md`. Rulings: `docs/plan/v2/RULINGS.md` (they win). Review: `docs/reviews/v2/L1-review.md`. Worktree: `/home/claude/wt2/L1-build`. Branch per slice `l1/sN-...`.

## Slices

| # | Slice | State | PR |
|---|---|---|---|
| 1 | Guest identity and guest playback token | merged | #221 |
| 2 | Watch page, local progress, analytics identity | merged | #227 |
| 3 | Account free catalog path and public GETs | merged | #232 |
| 4 | Guest chrome, title and series, Sign in to save | merged | #235 |
| 5 | Home, Browse, Search for guests | merged | #262 |
| 6 | Guest audience, Kids mode, settings | merged | #263 |
| 7 | My List explainer, return intent | merged | #264 |
| 8 | Guest Continue learning | merged | #265 |
| 9 | History import | merged | #266 |
| 10 | Abuse protection, Turnstile escalation | merged | #267 |
| 11 | Robots, journeys, documents | on PR | see below |

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

## Slice 4 (guest chrome, title and series, Sign in to save)

Exists:
- `components/guest/GuestChrome.tsx`: header, Main and Primary navs, footer, skip link. Props `platformName`, `logoUrl`, `footerLinks`, `year`, `signUpOpen`, `kids`. `AppShell` renders it for a signed out visitor while `features.guest_play` is on.
- `components/guest/SignInToSaveDialog.tsx`: `{ open, reason: 'my-list' | 'like', next, signUpOpen, onClose }`. L5 uses `reason="like"`. Links carry `?next=<encoded>`.
- `lib/guest/resume.ts`: `guestPrimary({ watchHref, durationSeconds }, entry)`.
- `TitleActions` and `WatchActions` take a `guest` prop. `WatchClient` takes `signUpOpen`.
- Title and series pages use `getViewerOrGuest`. The signed out preview stays only for guest play off.

Deviations: no `guest` prop on the shared `TopNav` (D-208). The sticky Play bar on a title page still shows the server label (Play) while the main button follows local progress. The `GuestResume` island of the plan is folded into `TitleActions`. The over-hero header backing is left to slice 5.

## Slice 5 (Home, Browse, Search for guests)

- `/` renders Home for a guest (guest play on). Browse, category and Search use `getViewerOrGuest`.
- `lib/data/guest-library.ts` `forGuests(inner)` is now wired in `lib/data/index.ts` (D-233). Slice 3 left `guestLibrary` unwired.
- Header over the hero: `data-over-hero` on `/` with the `--color-hero-chip-bg` backing.
- `AuthScreens.test.tsx` pins that sign in clears service worker caches before navigating.
- e2e `viewer-real` now expects `/browse` to stay and `/account` to redirect.

## Slice 6 (Kids mode, guestAudience)

- `setGuestAudienceAction(kids)` in `app/actions.ts`, `server/guest/set-guest-audience.ts`, `guestAudienceFromRequest` in `server/guest/guest-audience.ts`.
- `GuestChrome` takes `setKidsMode`: Menu with a Kids mode switch and the R17 help line; in Kids mode a Turn off Kids mode button above the footer.
- `GuestKidsBlocked` for a kids guest on an adult title (`RealCatalog.title` returns `{ blocked: 'kids' }` for guests).
- `getViewerContext`, the video runtime `getGuest` and the analytics resolver read the device audience.
- `client.json`: `guestAudience`, `guestPlay`. Admin Features: guest play switch, guest segment minutes. Not built: audience select in admin (D-234).
- Series pages have no blocked screen for kids guests yet; they still answer not found.

## Slice 7 (My List explainer, return intent)

- `lib/guest/intent.ts`: `saveIntent`, `takeIntent(store, kinds)`, `clearIntent`, key `ad:guest:intent:v1`, 30 minutes. L5: save `{ kind: 'like', itemKey }` through `SignInToSaveDialog intent=...` and call `takeIntent(localStorage, ['like'])` after sign in.
- `SignInToSaveDialog` takes `intent`. `TitleActions` and `WatchActions` pass it.
- `GuestIntentApplier` is mounted in `ViewerChrome`.
- `/my-list` for guests: `MyListExplainer`. `lib/guest/next-paths.test.ts` pins that guest return paths survive `safeNext`.

## Slice 8 (Guest Continue learning)

- `GuestContinueRow` is mounted at the top of the rows in `HomeView` for guests. Pure parts: `lib/guest/continue.ts`, `lib/guest/episodes.ts`.
- `ContinueRow` gained an optional `title`. `GuestEpisodeProgress` wraps `EpisodeList` on the series page for guests.
- The sticky Play bar and the series main button do not follow device progress yet.

## Slice 9 (History import)

- `packages/viewer/src/progress-import.ts` `importGuestProgress`, `MAX_IMPORT_ITEMS`. `api.progress.import` and `/api/progress/import`.
- Client: `lib/guest/import.ts` (`buildImportItems`, `runImport`), `ImportPrompt` mounted in `ViewerChrome`.
- Heads up: `messages-coverage.test.ts` fails on `main` for three `player.skip.*` keys that are not mine (L4). Dynamic `msg()` keys are not seen by that test, so write literal keys.

## Slice 10 (Abuse protection)

- `server/guest/challenge.ts` (`createGuestChallenge`, `GUEST_CHALLENGE_POLICY`, `TURNSTILE_HEADER`), `PlaybackHttpDeps.guestChallenge`, `ChallengeRequired` in `@ad/shared`.
- Player: `solveChallenge` option and `SessionError('challenge')`. Web: `GuestChallenge`, `useGuestChallenge`, `WatchClient` prop `challengeSiteKey`.
- DEPLOYMENT.md: guest session rate rule, Workers free plan note, Turnstile note.
- Not tested end to end with a real limiter store; the pieces are covered by unit tests with fakes.
- The older `guest.ip` playback buckets (`play-session-guest-ip`, `play-key-ip`) still use the address as subject, as `keyIp` did before. Hashing them is a follow up.

## Slice 11 (Robots, journeys, documents)

- `app/robots.ts` (Sitemap line appears when `app/sitemap.ts` exists; L6 should add it), `noindex` metadata on Search and My List.
- Guest session limits now key on `networkSubject(secret, ip, 'guest-session')`, a keyed hash of the truncated network (`PlaybackHttpDeps.guestSubject`). Slice 10's note about raw addresses is closed for guest sessions; the key route's `play-key-ip` bucket still keys on the address as before.
- The Turnstile check is never offered on a Kids playback page (`challengeKeyFor`), per SECURITY.md section 12.
- `apps/web/e2e/guest-journey.e2e.ts` and `guest-kids.e2e.ts`: written, type checked and linted, not run here (no browser or real services in this session). They skip without `E2E_REAL`.
- Documents: SECURITY.md (capability table, guest rule, limits, token claims, TTL fix, guest privacy), ARCHITECTURE.md (sections 10 to 12), USER-STORIES.md (module M40 and the 3.2 edits), MODULES.md, SCREEN-ARCHITECTURE.md (S80 to S89 and a guest flow), CLIENT-INPUTS.md, DEPLOYMENT.md (slice 10), CHANGELOG.md.
- The three doc mismatches are fixed: 2 hour segment URLs (SECURITY.md), 404 for a kids profile on a non-kid video (M31-S01), key limits (M31-S02).

## What exists (summary for other lanes)

- Guest principal: `ViewerContext.guest`, `guestContext(audience)`, `getViewerOrGuest(next)`. Account free catalog: `guest*` functions in `@ad/viewer` (`guest.ts`). Public GETs: `/api/home`, `/api/browse`, `/api/browse/categories`, `/api/search`, `/api/search/suggest`, `/api/titles/[id]`, `/api/titles/batch`.
- Playback: `POST /api/play/{id}/session` mints the guest cookie and token. Device storage keys: `ad:guest:progress:v1`, `ad:guest:intent:v1`. Cookies: `__Host-ad_guest`, `__Host-ad_gaud`.
- UI: `GuestChrome`, `SignInToSaveDialog` (L5: `reason="like"` and `intent`), `MyListExplainer`, `GuestContinueRow`, `GuestEpisodeProgress`, `GuestKidsBlocked`, `GuestChallenge`, `ImportPrompt`, `GuestIntentApplier`.
- Settings: `features.guest_play`, `features.guest_audience`, `limits.guest_segment_minutes`. `client.json`: `guestPlay`, `guestAudience`.
- Scoped test commands: `pnpm vitest run apps/web/src/components/guest apps/web/src/lib/guest apps/web/src/server/guest packages/video/src/playback/http.test.ts packages/viewer/src/progress-import.int.test.ts apps/web/src/server/viewer/route-matrix.int.test.ts` (integration files need `TEST_DATABASE_ADMIN_URL`).

## Gaps

- M40-S18 Clear history on this device is not built.
- Admin Features screen has the guest play switch and the segment minutes, but no audience select (use `client.json` or the settings API).
- Series pages have no Kids blocked screen for a guest (they answer not found). The title page does.
- The sticky Play bar and series main button do not follow device progress.
- `messages-coverage.test.ts` fails on `main` for three `player.skip.*` keys that belong to L4.
- Journey specs are not run.
