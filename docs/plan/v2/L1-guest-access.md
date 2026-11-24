# L1 Guest access (module M40): plan

Status: planning only, no feature code. Written 24 November 2026 against origin/main at 08d6e86. Evidence base: `docs/audits/2026-11-24-netflix-rea-audit.md` (section 5 is this lane). Every claim below that the audit made was checked against the code first. Corrections are listed in section 1.3.

Lane map used in section 7 (from the plan branch names): L2 home, L3 admin, L4 player, L5 engagement (likes, ratings, My List), L6 discovery (search, SEO), L7 languages, L8 design, L9 monetization, L10 account.

---

## 1. Scope and owner rule

### 1.1 Owner rule

There is no sign-up wall. Anyone can open the site, browse, search, open a title and press Play without an account. An account is needed only for things that belong to a person:

- My List.
- Likes and ratings (lane L5).
- Progress that follows the viewer across devices.
- Profiles.
- The password protected kids lock.

Everything else works for guests. A guest is never redirected to sign in just to look at or watch something. Sign in is offered, never required, and only at the moment a personal feature is used.

### 1.2 What a guest can and cannot do

| Area | Guest | Account |
|---|---|---|
| Home, Browse, categories, Search, suggestions | Yes, general audience by default | Yes, per profile |
| Title page, series page | Yes, with Play | Yes |
| Watch, captions, speed, quality, up next | Yes | Yes |
| Continue Watching | This device only (localStorage) | Server, every device |
| Resume position | This device only | Server, every device |
| My List, likes | No. A dialog offers sign in | Yes |
| Profiles, profile PIN, kids lock with password | No | Yes |
| Kids mode | A device switch, a convenience and not a lock | A kids profile with a password lock |
| Recent searches | None saved on the server | Per profile |
| Playback settings page, saved preferences | Device only (data saver already has a guest key) | Per profile |
| Account, export, deletion | No | Yes |

Route classes after this lane:

| Class | Routes | Behaviour for a signed out request |
|---|---|---|
| Public pages | `/`, `/browse`, `/browse/[categorySlug]`, `/search`, `/title/[slug]`, `/series/[slug]`, `/watch/[videoId]` | Render for a guest |
| Public GETs | `/api/home`, `/api/browse`, `/api/categories`, `/api/search`, `/api/search/suggest`, `/api/titles/[id]`, new `/api/titles/batch` | 200 with the guest audience |
| Guest playback | `POST /api/play/[id]/session`, `GET /api/play/[id]/*.m3u8`, `GET /api/hls/keys/[id]` | Session mints a guest token, the rest verify the token only (already true) |
| Personal | `/my-list` (explainer for guests), `/profiles*`, `/account*`, `/settings/*`, `/api/progress`, `/api/watch/progress`, `/api/my-list`, `/api/profiles*`, recent searches | Still 401 or redirect. `/my-list` shows an explainer instead of a redirect |
| Staff | `/admin*`, `/api/admin*` | Unchanged |

### 1.3 Audit claims checked against the code, and corrections

Confirmed:

- There is no auth middleware. `apps/web/src/proxy.ts` only sets CSP, security headers and request ids.
- Gates are `requireSession` and `requireProfile` (`apps/web/src/lib/session.ts`), `guard()` (`apps/web/src/server/viewer/api.ts`), `createRequestAuth.getViewer` (`apps/web/src/server/auth/request-auth.ts`), `PlaybackService.startSession` (`packages/video/src/playback/service.ts`), and `withAccount` plus `loadOwnedProfile` inside the `@ad/viewer` services.
- The key route, the playlist routes and the edge Worker check the playback token or the URL signature only. They never look at a session cookie. Analytics already accepts anonymous events (`resolveViewer` falls back to `profileId: null`).
- The playback token needs a string `aid` (`parseClaims` in `packages/video/src/playback-token.ts`). `pid` may already be null (staff previews).
- `/title` and `/series` render `PublicTitle` and `PublicSeries` for guests. Those have no Play button.
- Catalog tables carry no row level security. RLS covers only `accounts`, `my_list`, `profiles`, `search_history`, `staff_exports`, `watch_progress` and `watch_progress_removals`. `RealCatalog.publicPreview` already reads the catalog in a plain transaction with no `withAccount`. So an account-free catalog path is safe, and a guest query that touched a personal table would fail closed.
- Account segment URLs last 2 hours (`SEGMENT_URL_SECONDS`, D-120). Real hls.js recovery from an expired segment URL is already proven (D-120, `apps/web/e2e/hls-real.stack.ts`), which is what makes a shorter guest lifetime safe.

Corrections to the audit and to the docs:

1. Cookie name. Existing cookies use the `__Host-` prefix when secure (`__Host-ad_session`, `__Host-ad_profile`). The guest cookie is `__Host-ad_guest` (plain `ad_guest` when not secure), not `ad_guest`.
2. Where the cookie is set. Server Components cannot set cookies. "Set on first play" means inside the `POST /api/play/[id]/session` route handler, never in a page render.
3. "Transport mode `local`". `PlaybackTransport` is `'fixture' | 'http'` and one value drives both the session provider and the progress sink. Guests need the session over http and progress local, so progress gets its own type (`ProgressTransport = 'http' | 'local'`). The existing local sink (`createLocalProgressSink`) writes one key per video (`ad.progress.<profileId>.<videoId>`) with no timestamp and no cap, so it cannot give the audit's "cap 100, LRU". Guests get a new single-key store.
4. Server calls that must be switched off for guests, which the audit did not list. `WatchClient` passes `profileId: 'none'` to the session provider and runs `prefsSync.save` and `prefsSync.migrate` (server actions that need an account). For guests the session body carries no profile id and `prefsSync` is left undefined.
5. Analytics. Today an event with no profile gets `viewerHash: null` (`packages/analytics/src/ingest.ts`), so guests would never count as unique viewers. The guest id must feed the daily hash, or most uniques disappear.
6. A signed out request is not the same as a kids lock. A child on a kids-locked session who clears cookies becomes a guest on the general audience. The server side kids lock cannot stop that. Section 7 covers the mitigation and the honest copy.
7. Stories the audit did not list that must change: M10-S01, M10-S03, M06-S10 (it says in so many words "signed out search is not available"), M07-S01, M07-S03, M23-S03, M26-S06, M31-S01, M31-S02, M31-S03, M35-S01, M35-S03, M19-S01. Section 3.2 lists every edit.
8. Doc versus code mismatches found on the way, fixed in the final slice:
   - SECURITY.md section 9 says segment URLs last 6 hours. D-120 made it 2 hours and ARCHITECTURE.md section 10 already says 2.
   - M31-S01 AC3 says a kids profile on a non-kid video gets 403. The code throws `NotFound` (404), and SECURITY.md section 5 also says 404.
   - M31-S02 AC1 says the key needs "the session cookie". The key route checks the token only. AC3 says 30 per minute per session. The code and SECURITY.md say 20 per 10 minutes per profile plus 300 per minute per IP.
9. Side note outside this lane: the audit lists `.ad-tile:focus-visible` as possibly lacking its own ring. It has one (`.ad-tile:focus-visible .ad-tile__avatar` draws a 3px `--color-focus-ring` box shadow, `packages/ui/src/components.css`). A box shadow vanishes in forced colours mode, so add a transparent outline as a minor fix in lane L8.

No schema change is needed. No migration in any slice.

---

## 2. Detailed build list

Eleven slices. Each one merges on its own, each one starts with failing tests, and nothing outside the slice breaks if later slices are not built. Slices 1 and 2 are the playback path, so a guest can play from a direct `/watch/<id>` link after slice 2. Run only the scoped test files named (`pnpm vitest run <file>`). DB integration tests need the Postgres steps in `docs/DEV-SETUP.md`.

New settings keys live in `packages/theme/src/settings-registry.ts` (the existing `features.*` and `limits.*` registry). The client file `client.json` gets matching optional fields in `packages/launch/src/client-config.ts`. Both are listed in the slice that first needs them.

### Slice 1. Guest identity and guest playback token (server only)

Goal: a request with no account can mint a playback session, fetch playlists and the key. No UI.

Add:
- `apps/web/src/server/guest/guest-cookie.ts`: `guestCookieName(secure)` (`__Host-ad_guest` or `ad_guest`), `guestCookieOptions(secure)` (HttpOnly, SameSite Lax, Secure when configured, Path `/`, Max-Age 180 days), `newGuestId()` (128 bit random, base64url, via `randomToken(16)`), `signGuest(secret, id)` and `readGuest(secret, value)` returning the id or null. Same shape as `active-profile.ts`: MAC label `ad:guest:v1`, constant time compare. The key is derived from the existing profile cookie secret with the label (decision G3), so no new environment variable.
- `apps/web/src/server/guest/resolve-guest.ts`: `resolveGuest(request, { mint })` returning `{ guestId, isNew }`. It mints a new id only when `mint` is true and the cookie is absent or invalid.

Change:
- `packages/video/src/playback-token.ts`: `PlaybackClaims` gets `gst?: true` and `kd?: true`. `IssueInput` gets `guest?: boolean` and `kids?: boolean`. A guest token has `pid: null`, `aid` = guest id, `gst: true`, and never `pv`. `verifyPlaybackToken` rejects a token with both `gst` and `pv`. Old tokens still verify.
- `packages/video/src/playback/service.ts`: add `startGuestSession(guest: { guestId; kids }, videoId)`. It enforces published and ready (same `isLive`), kids safe when `kids`, and the new guest limiter policies. `variant()` uses `guestSegmentTtlSeconds` (default 20 minutes, from `PlaybackDeps`) when `claims.gst`, the account TTL otherwise. `key()` skips the profile lookup for guests, rate limits on `claims.aid`, and when `claims.kd` requires `video.kidsSafe`.
- `PLAY_POLICIES` gets `sessionGuest` (20 per minute per guest id) and `sessionGuestIp` (120 per minute per IP, generous for shared mobile networks, M23-S03 edge). The key limits stay as they are: they already take `pid ?? aid`, so a guest id is the subject.
- `packages/video/src/playback/http.ts`: `PlaybackHttpDeps` gets optional `getGuest(request, { mint })` and `guestPlayEnabled()`. In `session`, when `getViewer` throws `Unauthorized` and guest play is on, the guest path runs. A valid account session always wins over a guest cookie. The response carries `Set-Cookie` only when `isNew`. The same-origin check stays for every guest POST.
- `apps/web/src/server/video/runtime.ts` and `api.ts`: wire `getGuest`, `guestPlayEnabled` (from setting `features.guest_play`) and the segment TTL (setting `limits.guest_segment_minutes`).
- `packages/theme/src/settings-registry.ts`: add `features.guest_play` (bool, default true, public, tier super, group features, label "Guests can watch", description "Anyone can watch without an account. Off means guests can browse but must sign in to play.") and `limits.guest_segment_minutes` (int 5 to 120, default 20, private, tier super, group limits).

Failing tests first:
- `apps/web/src/server/guest/guest-cookie.test.ts`: round trip, forged MAC, different secret, truncated value, empty value, name has `__Host-` only when secure, options (HttpOnly, Lax, 180 days).
- `packages/video/src/playback-token.test.ts`: guest token round trip, `pid` null, `gst` plus `pv` rejected, token from before this change still verifies.
- `packages/video/src/playback/service.test.ts`: guest session for a published video, draft and deleted are 404, kids guest on a non-kid video is 404, guest limiter subject is the guest id, guest variant URLs expire within 20 minutes and account ones in 2 hours, guest key works, `kd` token on a non-kid video gets 404, forged token 401.
- `packages/video/src/playback/http.test.ts`: no session plus guest play on gives 200 and one `Set-Cookie`, valid guest cookie gives 200 and no `Set-Cookie`, account session wins, guest play off gives 401, cross origin POST gives 403.
- `apps/web/src/server/video/api.int.test.ts`: full chain with no account (session, master, variant, key), guest cookie forgery, kids guest.
- `apps/edge/src/handler.test.ts`: a segment URL with a forged signature and a short `exp` is still 403 (pins that the Worker is unchanged).
- `packages/theme/src/settings-registry.test.ts`: both keys, defaults, bounds.

Migrations: none.

Config keys: `features.guest_play`, `limits.guest_segment_minutes`.

Done when: from a clean cookie jar, `POST /api/play/<id>/session` with a same-origin header returns a token and one guest cookie, master, variant and key then return 200, segment URLs expire in 20 minutes or less, the key is 16 bytes, forged and cross origin requests fail, and every existing account playback test is unchanged and green.

### Slice 2. Watch page for guests, local progress, analytics identity

Goal: `/watch/<id>` opens and plays for a guest, remembers the place on the device, and counts in analytics.

Add:
- `apps/web/src/lib/guest/progress-store.ts`: single key `ad:guest:progress:v1`, value `{ v: 1, items: { [videoId]: { p, d, f, t } } }` (seconds played, duration, finished, last write in epoch ms). Cap 100 entries, evict least recently written. Functions: `readGuestProgress(store, videoId)`, `listGuestProgress(store, { limit })`, `writeGuestProgress`, `removeGuestProgress`, `clearGuestProgress`, `createGuestProgressSink(store)`. A corrupt value resets to empty. A storage error (blocked, full) is swallowed and reported once through a returned flag so the UI can show the storage note in slice 11.

Change:
- `apps/web/src/lib/data/playback.ts`: `ViewerContext` gains `guest?: true`.
- `apps/web/src/lib/data/playback.server.ts`: `getViewerContext(cookies, next)` no longer redirects a signed out request to sign in when guest play is on. It returns `{ profileId: 'none', kids, guest: true }`. When guest play is off it keeps today's redirect with `next`. Signed in behaviour is unchanged.
- `apps/web/src/server/data/real-playback.ts`: add the guest branch of `getWatchData` (published video, captions, sprite, next, up next and related filtered by audience, `saved: null`, default preferences, `inMyList: false`). Not found stays not found for drafts. In kids mode a non-kid video gives `kids-blocked`.
- `packages/player/src/http.ts`: `profileId` becomes optional and is omitted from the body when absent. This is the only player package change in this lane (coordinate with L4).
- `apps/web/src/features/player/WatchClient.tsx`: when `viewer.guest`, build the session provider without a profile id, use `createGuestProgressSink`, read the resume position from the guest store, pass no `prefsSync`, and keep preferences in device storage only. Add a `ProgressTransport` type so session transport and progress transport are separate.
- `apps/web/src/app/watch/[videoId]/page.tsx`: `robots: { index: false }` in metadata (the title page is the canonical page).
- Analytics: `apps/web/src/server/viewer/analytics-identity.ts` returns `{ profileId: null, audience, subjectId: guestId }` for a valid guest cookie. `packages/analytics/src/ingest.ts` hashes `subjectId ?? profileId` with the day. Audience `kids` still stores no identity.

Failing tests first:
- `apps/web/src/lib/guest/progress-store.test.ts`: cap of 100 with eviction order, newest write wins, finished flag, corrupt JSON, quota error, null storage, clear.
- `apps/web/src/lib/data/playback.server.test.ts`: guest gets a guest context with no redirect, guest play off redirects with `next`, signed in unchanged.
- `apps/web/src/server/data/real-playback.int.test.ts`: guest branch for published, draft is not found, kids guest on a non-kid video is `kids-blocked`.
- `packages/player/src/http.test.ts`: no `profileId` in the body when undefined.
- `apps/web/src/features/player/WatchClient.test.tsx`: guest session request has no profile id, no call to `prefsSync`, no call to `/api/progress`, progress lands in the guest store, resume reads it, offline screen unchanged.
- `apps/web/src/server/viewer/analytics-identity.int.test.ts`: guest hash is stable within a day and different the next day, kids guest has none.
- `packages/analytics/src/ingest.test.ts`: `subjectId` produces `viewerHash`, absent still null.

Migrations: none.

Done when: a fresh browser opens `/watch/<id>`, plays, reloads and resumes at the saved place, makes no request to `/api/progress`, and analytics shows the view and a unique viewer.

### Slice 3. Account-free catalog path and public GETs

Goal: the services and API behind Home, Browse, Search and titles answer a request with no account.

Add:
- `packages/viewer/src/guest.ts`: `getGuestHome`, `guestBrowse`, `guestCategories`, `guestSearch`, `guestSuggest`, `guestPopular`, `guestTitleDetail`, `guestSeries`, `guestTitlesByIds` (max 20 ids). Each takes `{ audience }` and no actor. They reuse the internals of `home.ts`, `browse.ts`, `search.ts` and `title-detail.ts`, refactored so the database work takes an audience and an optional profile. Personal rows are skipped, `annotateCards` gets a null profile and returns `progress: null`, `inMyList: false`. Guest search writes no `search_history`. The shared 60 second catalog cache keys (`home-rows`, `home-row`, by audience) are reused, so guests cost almost nothing extra.
- `apps/web/src/server/guest/guest-audience.ts`: `resolveGuestAudience(cookieValue, siteDefault)`, tri state, used here with the site default only (the cookie part ships in slice 6).
- `apps/web/src/server/viewer/public-api.ts`: `publicGuard(personal, guest)`. If `resolveActor` finds a signed in account the existing personal handler runs unchanged. Otherwise the guest handler runs. GET only (405 otherwise), per IP limit from the existing global API policy (300 per minute), guest id added as a second subject when the cookie exists. New `GET /api/titles/batch?ids=` (max 20, UUIDs only).
- `apps/web/src/lib/viewer.ts`: `Viewer = { kind: 'account', ... } | { kind: 'guest', audience }` and `getViewerOrGuest(next?)` in `apps/web/src/lib/session.ts`. Unverified accounts and accounts with no profile keep their redirects. Only a missing session becomes a guest.
- `apps/web/src/lib/data/types.ts`: `GuestViewerContext = { kind: 'guest'; audience }`. `CatalogRepository` methods accept `ViewerContext | GuestViewerContext`. `LibraryRepository` stays account only, with a helper returning empty answers for guests.

Change:
- `apps/web/src/server/data/real-catalog.ts` and `apps/web/src/lib/data/fixtures/catalog.ts`: branch on `kind === 'guest'`.
- Route files `app/api/home`, `browse`, `categories`, `search`, `search/suggest`, `titles/[id]` call the new guard. `app/api/titles/batch/route.ts` is new.
- `packages/viewer/src/schemas.ts`: `profileId` becomes optional on the home, browse, categories, search, suggest and title query schemas, and is ignored on the guest path.

Failing tests first:
- `packages/viewer/src/guest.int.test.ts`: published only, kids audience filter applied in the query, no personal data in the result, search writes nothing, unknown id list is dropped, ids over 20 refused.
- `apps/web/src/server/viewer/public-api.test.ts`: fake runtime, GET only, guest and account branches, a `profileId` query value on the guest path is ignored.
- `apps/web/src/server/viewer/route-matrix.int.test.ts`: route authorization matrix. Rows are every route in 1.2, columns are anonymous, guest cookie, forged guest cookie, viewer, kids-locked viewer. Public GETs are 200, personal routes are 401, and a kids-locked session still gets only kid titles.
- `apps/web/src/server/data/real-catalog.int.test.ts`: guest branch.
- `apps/web/src/lib/session.test.ts` (new): `getViewerOrGuest` for no session, unverified, no profile, active.

Migrations: none. Config keys: none.

Done when: `curl /api/home` with no cookies returns hero and rows with `progress: null` and `inMyList: false`, `/api/progress`, `/api/my-list` and `/api/profiles` still return 401, and every account test is green.

### Slice 4. Guest chrome, title and series pages, Sign in to save dialog

Goal: a guest can open a title or series, press Play, and sees the signed out header and tab bar. The My List button opens a dialog instead of failing.

Add:
- `apps/web/src/components/GuestChrome.tsx` (client): top navigation with logo, Home, Browse, My List, search icon, a Sign in button and (when `signUpOpen`) a Create account button on desktop. Bottom tab bar with the same four tabs as signed in. Footer. Skip link first.
- `apps/web/src/components/SignInToSaveDialog.tsx` (client, uses `Modal` from `@ad/ui`, a bottom sheet on mobile per DESIGN-SYSTEM 11.12). Props: `reason: 'my-list' | 'like'`, `next` path, `signUpOpen`. Buttons Sign in, Create account (hidden when sign up is closed), Not now. Both links carry the encoded `next`.
- `apps/web/src/components/title/GuestResume.tsx` (client island): reads the guest store and shows Resume, Watch again or Play on the title and series pages.

Change:
- `apps/web/src/components/Shell.tsx`: the signed out branch renders `GuestChrome` instead of the light public bar.
- `packages/ui/src/components/TopNav.tsx`: new optional `guest` prop (sign in and sign up hrefs, no avatar, no profile menu). Optional props only, so no other screen changes (coordinate with L8).
- `apps/web/src/app/(viewer)/title/[slug]/page.tsx` and `series/[slug]/page.tsx`: remove the `!session` preview branch, use `getViewerOrGuest`, render `TitleView` and the series view with a `guest` flag. `PublicTitle` and `PublicSeries` stay only for the guest play off case (M07-S06).
- `apps/web/src/components/title/TitleActions.tsx`: for guests the My List button uses the injected `toggle` prop to open the dialog, shows no `aria-pressed`, and carries `aria-haspopup="dialog"`. The offline write queue (`useListToggle`) is not used for guests.
- `apps/web/src/features/player/WatchActions.tsx`: same for the watch page My List button.
- `apps/web/src/lib/pwa/sign-out.ts` caller and the sign-in success path: purge service worker caches on sign in as well as sign out, so a signed in page never shows guest chrome from cache (see risks).

Failing tests first:
- `apps/web/src/components/Shell.test.tsx` (new): guest header has Sign in, Create account only when sign up is open, nav labelled Main, tab bar labelled Primary, skip link is first focusable.
- `apps/web/src/components/title/TitleView.test.tsx`: guest has a Play link to `/watch/<id>`, no "Sign in to watch", My List opens the dialog and does not change state.
- `apps/web/src/components/SignInToSaveDialog.test.tsx`: focus moves in, trapped, Escape closes and focus returns to the trigger, links carry the encoded `next`, Create account hidden when sign up is closed, copy per reason.
- `apps/web/src/components/title/GuestResume.test.tsx`: no progress shows Play, 5 seconds or more shows Resume with the time, finished shows Watch again.
- `packages/ui/src/components/TopNav.test.tsx`: guest variant renders buttons and no avatar, existing cases unchanged.
- `apps/web/src/lib/title-cta.test.ts`: extended for guests.

Migrations: none. Config keys: none.

Done when: a guest opens a title from a shared link, sees Play, plays it, taps My List and sees the dialog, closes it and keeps watching. Keyboard and screen reader pass on the dialog and header. Checked at 360, 768 and 1280 px.

### Slice 5. Home, Browse and Search for guests

Goal: `/` is Home for everyone, no landing sign in card.

Change:
- `apps/web/src/app/page.tsx`: a guest gets `AppShell` plus `HomeView` with a guest context. Signed in, unverified and no-profile behaviour is unchanged. The sign in card remains at `/sign-in`.
- `apps/web/src/components/home/HomeView.tsx` and `HomeHero.tsx`: accept the guest context, hero Play links straight to `/watch/<id>`, no personal rows, data saver from the device preference (`dataSaverKey(null)` already exists).
- `apps/web/src/app/(viewer)/browse/page.tsx`, `browse/[categorySlug]/page.tsx`, `search/page.tsx`: `getViewerOrGuest`. Search shows no recent searches for guests.
- `apps/web/src/components/browse/*`: pass the guest context to the client fetches that call the public GETs.

Failing tests first:
- `apps/web/src/app/page.test.tsx` (new): guest renders Home, not the sign in card, signed in unchanged, unverified redirects.
- `apps/web/src/components/home/HomeView.test.tsx`: guest has no Continue Watching and no My List row, hero Play href, empty catalog state.
- `apps/web/src/components/browse/BrowseView.test.tsx` and `SearchScreen.test.tsx`: guest paths, no recent searches.
- `packages/viewer/src/browse-search.int.test.ts`: guest search leaves `search_history` untouched.

Migrations: none. Config keys: none.

Done when: opening the site root signed out shows the hero and rows, Browse and Search work, and the first Play from Home needs no sign in.

### Slice 6. Guest audience, Kids mode toggle, site setting

Goal: guests see the general audience by default, can switch Kids mode on their device, and the owner can change the default.

Add:
- Setting `features.guest_audience` in `packages/theme/src/settings-registry.ts`: enum `general | kids`, default `general`, public, tier admin, group features, label "Default for visitors without an account", description "Choose what visitors see before they sign in. They can switch Kids mode on or off on their own device."
- `client.json` fields `guestAudience` (`general` or `kids`) and `guestPlay` (boolean), both optional. Mapped in `desiredSettings` in `packages/launch/src/apply.ts`, validated in `client-config.ts`, shown in `client.example.json` and `docs/CLIENT-INPUTS.md`.
- `apps/web/src/server/guest/guest-audience.ts`: cookie `__Host-ad_gaud` (`k` or `g`, unsigned, HttpOnly, 180 days). Absent means the site default. Set by a server action `setGuestAudienceAction` in `apps/web/src/app/actions.ts`.
- `apps/web/src/components/GuestKidsToggle.tsx` (client): a switch in the header menu, a Kids mode badge in the header when on, and a toast on change. It never asks for a password and never says "locked" or "safe".
- Device hint: selecting a kids profile (`/api/profiles/[id]/select`) also sets `__Host-ad_gaud=k`. Exiting kids mode with the password (`exitKids`) clears it. If the session later disappears, the device stays in Kids mode.

Change:
- `resolveGuestAudience` is used by the public guard (slice 3), the guest watch branch (slice 2), the guest session mint (slice 1) and the pages (slices 4 and 5).
- `apps/web/src/app/watch/[videoId]/page.tsx` and the title and series pages: a guest on a non-kid title in Kids mode sees "This video is not in Kids mode" with a Turn off Kids mode button and a Browse link. A signed in kids profile keeps today's screen.
- `apps/web/src/components/GuestChrome.tsx`: in Kids mode Sign in and Create account move into the menu so a child is not nudged.

Failing tests first:
- `apps/web/src/server/guest/guest-audience.test.ts`: tri state, junk value falls back to the site default.
- `packages/theme/src/settings-registry.test.ts`, `packages/launch/src/client-config.test.ts`, `packages/launch/src/apply.test.ts`: the new key and fields, bad values refused.
- `apps/web/src/components/GuestKidsToggle.test.tsx`: states, keyboard, `aria-checked`, toast, no password.
- `apps/web/src/server/viewer/route-matrix.int.test.ts`: kids guest never receives a non-kid title from any public GET or from the session mint.
- `apps/web/src/server/viewer/api-kids-lock.int.test.ts`: selecting a kids profile sets the device hint, exit clears it.
- `packages/video/src/playback/service.test.ts`: already covers `kd` (slice 1), extend for the site default.

Migrations: none. Config keys: `features.guest_audience`, client fields `guestAudience`, `guestPlay`.

Done when: toggling Kids mode changes Home, Browse, Search, up next and related at once, a direct link to an adult title shows the new screen, the site default is honoured when the device has no choice, and the toggle copy makes no safety promise.

### Slice 7. My List explainer and return intent

Goal: personal pages and actions guide a guest to sign in without a redirect, and a pending action completes after sign in.

Add:
- `apps/web/src/components/mylist/MyListExplainer.tsx`.
- `apps/web/src/lib/guest/intent.ts`: `ad:guest:intent:v1` in sessionStorage, `{ action: 'my-list-add', itemKey, path, at }`, expires after 30 minutes. `SignInToSaveDialog` writes it before navigating.
- `apps/web/src/components/GuestIntentApplier.tsx` (client, mounted in `ViewerChrome`): after sign in and profile pick, when the intent matches and the title is allowed for the profile, add it through `toggleListAction`, show the "Added to My List" toast, clear the intent. Anything doubtful clears the intent silently.

Change:
- `apps/web/src/app/(viewer)/my-list/page.tsx`: a guest gets the explainer, not a redirect.
- `SignInToSaveDialog` takes `reason: 'like'` for lane L5 to call.

Failing tests first:
- `apps/web/src/components/mylist/MyListExplainer.test.tsx`: copy, Sign in primary, Create account secondary and hidden when sign up is closed, Browse link, Kids mode variant.
- `apps/web/src/lib/guest/intent.test.ts`: expiry, junk value, only same-origin paths, storage blocked.
- `apps/web/src/components/GuestIntentApplier.test.tsx`: applies once, ignores a kids-blocked title, ignores an expired intent.
- `apps/web/src/lib/auth-next.test.ts` (new or extend the existing `next` tests): the return path is same-origin only.

Migrations: none. Config keys: none.

Done when: a guest taps My List on a title, signs in, picks a profile, lands on the title and the item is already in My List with a toast. `/my-list` for a guest is a page, never a redirect.

### Slice 8. Continue Watching for guests

Goal: guests get a Continue Watching row and Resume labels from device progress.

Add:
- `apps/web/src/components/home/GuestContinueRow.tsx` (client): reads `listGuestProgress` (unfinished, 5 seconds or more, newest 20), fetches `/api/titles/batch`, renders the existing row with progress bars. Titles that are no longer available are dropped and pruned from the store. A failing fetch hides the row. A Remove action deletes the entry locally with an Undo toast (matches the account behaviour).
- `apps/web/src/components/title/GuestEpisodeProgress.tsx` (client island): progress bar and watched tick on series episodes.

Change:
- `HomeView.tsx` mounts the row for guests in the position the Continue Watching row has for accounts.

Failing tests first:
- `apps/web/src/components/home/GuestContinueRow.test.tsx`: hidden when empty, skeleton at card ratio after 300 ms, error hides the row, unavailable ids pruned, remove and undo.
- `apps/web/src/app/api/titles/batch/route.test.ts`: cap of 20, UUID validation, audience filter, rate limit.
- `apps/web/src/components/title/GuestEpisodeProgress.test.tsx`.

Migrations: none. Config keys: none.

Done when: a guest who stops a video sees it in Continue Watching on Home with the right bar and resumes at the right second.

### Slice 9. Import device history after sign in

Goal: offer to move guest progress into the account, once, with consent.

Add:
- `packages/viewer/src/progress-import.ts`: `importProgress(ctx, actor, { profileId, entries })`. At most 100 entries. Each entry `{ videoId, positionMs, finished, updatedAtMs }`. Validates UUIDs and ranges (`positionMs` 0 to 86,400,000, `updatedAtMs` not in the future), drops unknown, unpublished and (for a kids profile) non-kid videos, inserts only when the profile has no row or an older one, never overwrites newer server data. Returns `{ imported, skipped, unavailable }`. Uses the `progress` rate limit bucket plus one import per minute.
- `apps/web/src/app/api/progress/import/route.ts` and `api.progress.import` in `apps/web/src/server/viewer/api.ts`, guarded, mutating, same origin, body limit 32 KB.
- `packages/viewer/src/schemas.ts`: `importProgressBody`.
- `apps/web/src/components/home/ImportPrompt.tsx` (client): inline banner at the top of Home for a signed in, non-kids profile when the guest store has entries and the device has not answered before (`ad:guest:import:v1`). Buttons Add them and No thanks. Success clears the imported entries from the guest store. The answer is remembered per device, so a different person signing in later is not asked (decision G7).

Failing tests first:
- `packages/viewer/src/progress-import.int.test.ts`: only fills missing or older rows, newer server row wins, over 100 refused, bad UUIDs, future timestamps, unpublished dropped, kids profile rejects non-kid, foreign profile is 404.
- `apps/web/src/server/viewer/api.int.test.ts`: import route 401 signed out, 403 cross origin, 413 over limit, 429 over rate.
- `apps/web/src/components/home/ImportPrompt.test.tsx`: shown once, hidden for a kids profile, hidden with an empty store, success, partial, error with retry, "No thanks" remembered.

Migrations: none. Config keys: none.

Done when: a guest watches three videos, signs in, sees the prompt, accepts, and the three appear in Continue Watching with the right positions. Declining leaves everything as it was and never asks again on that device.

### Slice 10. Abuse protection and challenge escalation

Goal: guest playback cannot be used to hammer the server cheaply.

Add:
- `apps/web/src/server/guest/challenge.ts`: counts denials per IP (bucket `play-guest-denied`). After 3 in 10 minutes the guest session endpoint answers 403 `{ error: { code: 'challenge_required' } }` unless the body carries a `turnstileToken` that `verifyTurnstile` accepts. With no Turnstile keys the endpoint only answers 429 with `Retry-After`, as today.
- `apps/web/src/components/player/GuestChallenge.tsx` (client): Turnstile widget inside a `Modal`, then retries the session.

Change:
- `packages/player/src/http.ts` and the player error states: new `SessionError('challenge')` and a matching state (coordinate with L4). Existing `rate-limited` copy gets a wait time.
- `packages/video/src/playback/service.ts`: tune `PLAY_POLICIES` guest values from slice 1 with the constants pinned in tests.
- `docs/DEPLOYMENT.md`: a Cloudflare rate limiting rule for `/api/play/*/session` and `/api/hls/keys/*` (60 requests per minute per IP, then managed challenge) and a note on the Workers free plan (about 1,200 plays a day, 100,000 requests) with the paid plan advice.

Failing tests first:
- `apps/web/src/server/guest/challenge.test.ts`: threshold, window expiry, token verify, keys absent.
- `apps/web/src/server/video/api.int.test.ts`: denial count leads to `challenge_required`, a valid token clears it, an invalid token does not.
- `packages/player/src/http.test.ts` and the player state test: challenge code mapped.
- `apps/web/src/components/player/GuestChallenge.test.tsx`: focus, Escape, failure message, retry.
- `packages/video/src/playback/service.test.ts`: policy constants.

Migrations: none. Config keys: none new (uses `features.guest_play` as the emergency switch and `limits.guest_segment_minutes`).

Done when: a scripted client that mints sessions in a loop is slowed, then challenged, while a normal viewer on shared mobile data is never challenged.

### Slice 11. Search engines, journey tests, documents

Add:
- `apps/web/src/app/robots.ts`: allow `/`, `/title/`, `/series/`, `/browse`. Disallow `/api/`, `/admin`, `/account`, `/profiles`, `/settings`, `/watch/`, `/search`, `/my-list`, `/sign-in`, `/sign-up`. Adds a `Sitemap:` line only when lane L6 has shipped the sitemap (contract in section 7).
- `apps/web/e2e/guest-journey.spec.ts` (Playwright): fresh context, Home, open a title, Play, progress saved, reload resumes, My List dialog, sign in, intent applied, import prompt accepted.
- `apps/web/e2e/guest-kids.spec.ts`: toggle, filtered Home, blocked direct link, device hint after a kids profile.
- `apps/web/e2e/hls-real.stack.ts`: extend with a guest plays a real stream and recovers from an expired guest segment URL.

Change (documents):
- `docs/SECURITY.md`: capability table (Anonymous column for browse, watch, search), guest cookie, rate limit rows for guests and public reads, section 9 token claims and TTL (fix the 6 hour line), section 12 guest and kids wording and the NDPA items (guest cookie, anonymous analytics id).
- `docs/ARCHITECTURE.md`: section 10 TTL for guests, section 11 claims `gst` and `kd`, section 12 note that guest HTML is not edge cached.
- `docs/USER-STORIES.md`: add module M40 and apply the edits in 3.2. `docs/SCREEN-ARCHITECTURE.md`: entries for S80 to S89. `docs/CLIENT-INPUTS.md`: `guestAudience`, `guestPlay`. `docs/DEPLOYMENT.md` as in slice 10. `docs/lanes/L1-guest.md`: what exists, APIs, routes, scoped test commands, gaps. `CHANGELOG.md`: append.
- The main session updates `ai-context.md` (lane etiquette).

Failing tests first:
- `apps/web/src/app/robots.test.ts`.
- `apps/web/src/app/watch/[videoId]/page.test.tsx`: noindex metadata.
- `apps/web/src/server/viewer/route-matrix.int.test.ts`: final version covers every row of 1.2.
- The two Playwright specs above (written failing, then green).

Migrations: none. Config keys: none.

Done when: every Must and Should story in section 3 maps to a passing test, the matrix is complete, SECURITY.md and ARCHITECTURE.md describe what the code does, and `scripts/footprint-check.sh` is clean.

---

## 3. Stories

### 3.1 New module M40 Guest access

Add this block to `docs/USER-STORIES.md` after the last module (M36 today), and add M40 to `docs/MODULES.md`. Personas: Viewer (Tobi) as the guest, Parent for the Kids mode stories, Admin (Sister Vanessa) and Super admin (ARKDEV) for settings.

## M40 Guest access

### M40-S01 Browse and search without an account (Must)
As a visitor, I want to browse and search without signing up, so that I can see what the site offers before I decide anything.
- AC1: Given I have no account, When I open `/`, Then I see the hero and rows (not a sign in card), the same layout an account holder sees without personal rows.
- AC2: Given I am a guest, When I open Browse, a category or Search, Then results load and I can open any title.
- AC3: Given I am a guest, When I open a personal page (`/profiles`, `/account`), Then I go to sign in with the path kept in `next`, and when I open `/my-list` I see the explainer (M40-S08).
- Edge: a guest sees the general audience unless Kids mode is on (M40-S09). Guest search saves nothing on the server and shows no recent searches.
- Error: a failed load shows the normal retry card and the header stays usable. A rate limited search shows "Slow down a little" with a countdown (M06-S10).
- Empty: with no published titles the page shows "New videos are on the way" (M05-S07).

### M40-S02 Play without an account (Must)
As a visitor, I want to press Play and watch, so that nothing stands between me and the video.
- AC1: Given I have no account, When I press Play on a title, series, hero or card, Then playback starts exactly as for an account holder, with no sign in step.
- AC2: Given I press Play, When the server sees no account session, Then it issues a guest playback token (30 minutes, `pid` null, `gst` set) for a published video and the player loads the playlist, key and segments as usual.
- AC3: Given I am a guest, When the token nears expiry or a segment URL expires, Then the player refreshes through a new session without an error (M08-S21).
- AC4: Given the owner has switched guest play off, When I press Play, Then I see "Sign in to watch" with Sign in and Create account, and `next` returns me to the title.
- Edge: a signed in account always takes priority over a guest cookie. Staff previews are unchanged.
- Error: a draft, deleted or unknown video is "This video is not available" (404). A limit hit shows the wait message (M40-S11). A failure to start shows "We could not start this video. Try again" with Retry.
- Empty: not applicable.

### M40-S03 Guest identity cookie (Must)
As the owner, I want a guest to be recognisable only as much as playback needs, so that limits work without collecting personal data.
- AC1: Given a guest presses Play for the first time, When the session route answers, Then it sets one cookie `__Host-ad_guest` (HttpOnly, SameSite Lax, Secure, Path `/`, 180 days) holding a random 128 bit id and a signature.
- AC2: Given the cookie exists and verifies, When the guest plays again, Then no new cookie is set.
- AC3: Given the cookie is forged, truncated or signed with another key, When the guest plays, Then it is treated as absent and a new one is issued.
- AC4: Given a guest only browses, When pages load, Then no guest cookie is set.
- Edge: the id is never shown, never stored with a name or email, and the account id and guest id are different spaces.
- Error: cookies blocked means each play mints a new id, limits then fall back to the IP subject and playback still works.
- Empty: not applicable.

### M40-S04 Guest progress on this device (Must)
As a guest, I want my place remembered, so that I can come back and resume.
- AC1: Given I watch as a guest, When progress is due (M08-S16), Then it is written to this device only, under one storage key, and no request goes to `/api/progress`.
- AC2: Given I open a video I watched before, When the page loads, Then playback resumes at position minus 3 seconds with the usual toast (M08-S15).
- AC3: Given the store holds 100 titles, When I watch a new one, Then the least recently watched entry is dropped.
- AC4: Given the stored data is corrupt, When the page loads, Then it is treated as empty and playback starts at 0.
- Edge: a finished video shows Watch again. Progress is per browser and per device, never shared across devices for guests.
- Error: blocked or full storage never stops playback. A small note says "Your place is not being saved on this device" once per visit (S89).
- Empty: no saved place means playback starts at 0.

### M40-S05 Title and series pages for guests (Must)
As a guest, I want a full title page with a Play button, so that I can decide and watch from one place.
- AC1: Given I open `/title/<slug>` as a guest, When it loads, Then I see poster, title, duration, categories, description, caption badge, Play (or Resume 2:14 from this device) and My List.
- AC2: Given I open `/series/<slug>`, When it loads, Then I see the episode list with progress from this device and the primary button says "Resume S1 E3" or "Play S1 E1".
- AC3: Given the page is shared, When someone opens the link, Then Open Graph tags show the title and picture and search engines may index the page.
- Edge: an old slug redirects as today. Guest play switched off shows the public preview with Sign in to watch (M07-S06).
- Error: not found shows the 404 page. In Kids mode a non-kid title shows "This video is not in Kids mode" with Turn off Kids mode and Browse (M40-S09).
- Empty: a series with no published episode is a 404.

### M40-S06 Signed out header and navigation (Must)
As a guest, I want the same navigation as everyone else plus a clear way to sign in, so that I can move around and join when I want.
- AC1: Given I am signed out on desktop, When any page loads, Then the header shows logo, Home, Browse, My List, search and a Sign in button, plus Create account when sign up is open.
- AC2: Given I am signed out on a phone, When any page except the watch page loads, Then I see the top bar with logo, search icon and Sign in, and the bottom tab bar with Home, Browse, Search and My List.
- AC3: Given I open the menu, When it shows, Then it holds Kids mode, Data saver, Help, Sign in and Create account (when open).
- Edge: Sign in keeps the current path in `next`. The profile picker is never shown to a guest. Create account is hidden when sign up is closed.
- Error: not applicable.
- Empty: not applicable.

### M40-S07 Sign in to save (Must)
As a guest, I want a clear, short prompt when I try to save something, so that I understand why an account is needed and can say no.
- AC1: Given I am a guest, When I tap My List on a card, title, series or watch page, Then a dialog (bottom sheet on a phone) opens titled "Save this to My List" with Sign in, Create account and Not now, and nothing is stored.
- AC2: Given the dialog is open, When I press Escape, tap Not now or tap outside, Then it closes, focus returns to the button and I keep watching or browsing.
- AC3: Given I choose Sign in or Create account, When I leave, Then `next` holds the current path and the pending action is remembered for 30 minutes.
- AC4: Given likes exist (lane L5), When a guest likes a title, Then the same dialog opens with the like wording.
- Edge: Create account is hidden when sign up is closed. The button has no pressed state for guests.
- Error: not applicable. The dialog does no network call.
- Empty: not applicable.

### M40-S08 My List explainer for guests (Must)
As a guest, I want `/my-list` to explain itself, so that I am not thrown to a sign in page.
- AC1: Given I open `/my-list` as a guest, When it loads, Then I see "My List" and "Save videos to watch later", one sentence ("Sign in or create a free account to keep a list that follows you on every device."), a Sign in button, a Create account button and a Browse videos link.
- AC2: Given I have progress on this device, When the page loads, Then a link to Continue Watching on Home is shown.
- Edge: Create account is hidden when sign up is closed.
- Error: not applicable.
- Empty: this is the empty state.

### M40-S09 Guest audience and Kids mode toggle (Must)
As a parent sharing a device, I want a Kids mode switch for visitors, so that the screen shows videos made for children.
- AC1: Given I am a guest and the site default is general, When I switch Kids mode on, Then Home, Browse, Search, up next and related show only kid suitable titles at once, enforced in the query, and the header shows a Kids mode badge.
- AC2: Given Kids mode is on, When a direct link to a non-kid title opens, Then I see "This video is not in Kids mode" with Turn off Kids mode and Browse, and no playback session is issued.
- AC3: Given I switch Kids mode off, When I confirm, Then no password is asked and everything returns to general.
- AC4: Given the device has made no choice, When I open the site, Then the site setting `guestAudience` decides.
- AC5: Given I select a kids profile while signed in, When I later lose my session, Then this device stays in Kids mode until it is switched off.
- Edge: the switch is a convenience, not a lock. Its help text says "Shows videos made for children. Anyone using this device can turn it off." Copy never says locked or safe. A guest in Kids mode stores no analytics identity.
- Error: a failure to save the choice shows "We could not change Kids mode. Try again." and keeps the old state. A filter failure returns an empty list, never an unfiltered one.
- Empty: with no kid titles Home shows "Nothing here yet. Ask a grown-up to turn off Kids mode."

### M40-S10 Guest settings the owner controls (Must)
As the owner, I want to choose what visitors see and whether they can watch without an account, so that I stay in control.
- AC1: Given Settings, Features, When I open it, Then I see "Default for visitors without an account" (General or Kids, default General) and "Guests can watch" (default on), with the plain descriptions from the registry.
- AC2: Given `client.json` has `guestAudience` and `guestPlay`, When I run `pnpm launch:apply`, Then the settings take those values, and a second run reports unchanged.
- AC3: Given guest play is switched off, When a guest presses Play, Then they see Sign in to watch (M40-S02 AC4), while browsing still works.
- Edge: both settings are Super admin only for guest play and Admin for the audience, and every change is audited.
- Error: an invalid value is refused with the field named.
- Empty: not applicable.

### M40-S11 Guest abuse protection (Must)
As the owner, I want guest playback limited, so that open access does not become an open tap.
- AC1: Given a guest id mints more than 20 sessions in a minute, When the next arrives, Then it returns 429 with Retry-After and the player shows a plain wait message.
- AC2: Given an IP mints more than 120 guest sessions in a minute, When the next arrives, Then it returns 429 (generous because mobile networks share addresses).
- AC3: Given a guest token, When segment URLs are issued, Then they expire in 20 minutes (setting `limits.guest_segment_minutes`), while account URLs last 2 hours.
- AC4: Given key requests from one guest exceed 20 per 10 minutes or from one IP exceed 300 per minute, When exceeded, Then 429.
- Edge: refused requests write a log line with route, status, video id and IP, never a token or cookie.
- Error: a limiter store failure follows the documented rule in M23-S03 AC2 and is logged.
- Empty: not applicable.

### M40-S12 Challenge after repeated limits (Should)
As the owner, I want a human check after repeated abuse, so that real viewers are not blocked.
- AC1: Given an IP hits the guest limits 3 times in 10 minutes and Turnstile is configured, When the next session is requested, Then it answers `challenge_required` and the player shows a short check.
- AC2: Given the viewer passes the check, When the session is retried, Then playback starts.
- AC3: Given Turnstile keys are absent, When the limits are hit, Then only the 429 wait applies.
- Edge: the check never appears for a normal viewer. Kids playback pages follow SECURITY.md section 12 (no third party script) so the check there is replaced by the wait message.
- Error: check failure shows "We could not confirm you are human. Try again."
- Empty: not applicable.

### M40-S13 Move device history into my account (Should)
As a guest who just signed in, I want my watched videos added to my profile, so that I do not lose my place.
- AC1: Given I sign in, pick a non-kids profile and this device holds guest progress, When Home loads, Then a banner asks "Add the 6 videos you watched on this device to your profile?" with Add them and No thanks.
- AC2: Given I choose Add them, When the import runs, Then at most 100 entries are sent, only missing or older server rows are filled, newer server data is never overwritten, and I see "Added 6 videos to Continue Watching".
- AC3: Given I choose No thanks, When I dismiss, Then the device never asks again and the guest data stays.
- AC4: Given the profile is a kids profile, When Home loads, Then no prompt shows.
- Edge: videos no longer available are skipped with "Added 5 of 6. One is no longer available." Imported entries are removed from the device store. The prompt is asked once per device, not per account.
- Error: failure shows "We could not add them. Try again." with Retry, and nothing is removed.
- Empty: with no device progress there is no prompt.

### M40-S14 Continue Watching for guests (Should)
As a guest, I want Continue Watching on Home, so that I get back to what I was watching.
- AC1: Given I have unfinished progress on this device, When Home loads, Then a Continue Watching row shows up to 20 titles with progress bars, in the same place accounts see it.
- AC2: Given I remove an item, When I confirm, Then it leaves the row at once with an Undo toast for 6 seconds.
- AC3: Given a title was unpublished or is not allowed in Kids mode, When the row loads, Then it is dropped and removed from the device store.
- Edge: the row is hidden when empty.
- Error: a failed lookup hides the row and never blocks the rest of Home.
- Empty: the row is not rendered.

### M40-S15 Finish a save after sign in (Should)
As a guest who chose to sign in to save, I want the save to happen, so that I do not repeat myself.
- AC1: Given I opened the dialog on a title and signed in, When I land back on that title with a profile, Then the title is added to My List and "Added to My List" shows.
- AC2: Given more than 30 minutes passed, When I land, Then nothing is added.
- AC3: Given the title is not allowed for the chosen profile, When I land, Then nothing is added and no error shows.
- Edge: the pending action is held in session storage only and cleared after use.
- Error: a failed add shows the standard My List error toast (M10-S01 AC2).
- Empty: not applicable.

### M40-S16 Guest analytics and privacy (Must)
As a viewer, I want guest analytics to stay anonymous, so that I am not tracked.
- AC1: Given a guest plays a video, When events are recorded, Then the stored viewer id is a hash of the guest id and the day, so it changes daily and the guest id itself is not stored.
- AC2: Given a guest is in Kids mode, When events are recorded, Then no viewer id is stored.
- AC3: Given the Privacy page, When viewed, Then it names the guest cookie, its purpose (limits and playback) and its life (180 days), and the anonymous daily id.
- Edge: no third party scripts. Clearing cookies makes the next day count as a new viewer, which is accepted.
- Error: an analytics failure never affects playback (M19-S01).
- Empty: not applicable.

### M40-S17 Search engines can see public pages (Should)
As the owner, I want titles to be found on search engines, so that more people arrive.
- AC1: Given a crawler requests `/robots.txt`, When it answers, Then it allows `/`, `/title/`, `/series/` and `/browse` and disallows `/api/`, `/admin`, `/account`, `/profiles`, `/settings`, `/watch/`, `/search`, `/my-list`, `/sign-in` and `/sign-up`.
- AC2: Given a crawler opens a title page, When it loads, Then the page has real content, a canonical URL and Open Graph tags.
- AC3: Given a watch page, When it loads, Then it is marked noindex.
- Edge: the sitemap and structured data belong to lane L6. The `Sitemap:` line is added only when the sitemap exists.
- Error: not applicable.
- Empty: not applicable.

### M40-S18 Clear history on this device (Could)
As a guest on a shared device, I want to clear what this device remembers, so that others do not see my history.
- AC1: Given I open the menu, When I choose Clear history on this device, Then a confirm asks "Clear history on this device? This removes your places and Continue Watching here. This cannot be undone." with Clear history and Keep it.
- AC2: Given I confirm, When it finishes, Then the guest progress, the import answer and Kids mode choice for this device are removed and a toast confirms.
- Edge: signed in accounts see Sign out instead.
- Error: failure shows an error toast and keeps the data.
- Empty: with no history the item is hidden.

### 3.2 Edits to existing stories

Apply each as written. Where a line is "Replace", the whole line changes. "Add" appends a new line in the position named.

1. M01-S13, AC1. Replace with: "AC1: Given I choose Sign in from a title page or from a Save dialog, When I am sent to sign in, Then the `next` parameter holds the path and I return to it after sign in and profile pick." Replace the Edge line with: "Edge: the title page opens for everyone with a Play button (M40-S05) and Open Graph tags for sharing. A signed out visitor is never redirected to sign in just to view or watch."
2. M01-S14. Add after Edge: "Edge: the same Turnstile keys protect guest playback after repeated limit hits (M40-S12)."
3. M07-S06. Replace the title with "M07-S06 Public preview when guest play is off (Should)". Replace AC1 with: "AC1: Given the owner has switched guest play off, When I open `/title/<slug>` signed out, Then I see poster, title, description and a Sign in to watch button, with no player." Keep AC2. Add: "Edge: with guest play on, the page is the full title page (M40-S05)."
4. M07-S01. Add after AC3: "AC4: Given I am a guest, When I tap My List, Then the Sign in to save dialog opens (M40-S07) and the button state does not change." Add Edge: "for guests Resume uses progress kept on this device (M40-S04)."
5. M07-S03. Add Edge: "For guests the saved position comes from this device (M40-S04)."
6. M08-S01. Add after AC4: "AC5: Given I have no account, When I press Play, Then playback starts the same way with no sign in step (M40-S02)."
7. M08-S15. Add after AC3: "AC4: Given I am a guest, When I open the watch page, Then the saved position comes from this device (M40-S04)."
8. M08-S16. Add after AC4: "AC5: Given I am a guest, When progress is due, Then it is written to this device only and no request goes to `/api/progress` (M40-S04)." Replace the Error line with: "Error: a 401 pauses playback and prompts sign in (M01-S12) for signed in viewers. A guest session that cannot start shows 'We could not start this video. Try again' with Retry. A 403 for profile mismatch returns to the picker."
9. M08-S31. Add Edge: "Guests do not get this: their progress stays on the device. Signing in syncs it, and M40-S13 moves device progress into the account."
10. M05-S05. Add Edge: "guests have no My List row. A Continue Watching row appears from this device's progress (M40-S14)." Replace Empty with: "Empty: a new profile or a guest without device progress sees curated rows only."
11. M05-S06. Add after AC2: "AC3: Given Kids mode is on for a guest, When Home loads, Then AC1 applies and the header shows a Kids mode badge (M40-S09)."
12. M03-S01. Add Edge: "guests never see the picker. Signing in leads here (M40-S06)."
13. M03-S11. Add Edge: "a guest has no profile to remember. Kids mode on a guest device is remembered separately (M40-S09)."
14. M06-S10. Replace the Edge line with: "Edge: signed out visitors can search. Their limit is per IP and per guest id (60 per minute), and their searches are not saved on the server."
15. M10-S01. Add after AC3: "AC4: Given I am a guest, When I tap the plus button, Then the Sign in to save dialog opens and nothing is stored (M40-S07)."
16. M10-S03. Add Edge: "guests see an explainer instead of a list (M40-S08)."
17. M19-S01. Add Edge: "guest plays count like any other play."
18. M19-S07. Replace AC1 with: "AC1: Given the platform, When it records events, Then it stores profile id and video id for resume only, and uses an anonymous daily rotating id for analytics counts. For guests that id is a hash of the guest id and the day, so the guest id is never stored in analytics (M40-S16)." Add to AC2: "and names the guest cookie."
19. M23-S03, AC1. Replace with: "AC1: Given limits (sign in, sign up, reset, resend, search, progress, key requests, guest playback sessions, public catalog reads), When exceeded, Then 429 with Retry-After is returned and the UI shows a plain wait message."
20. M26-S06, AC1. Replace with: "AC1: Given the site only uses essential cookies and local storage (the session, profile, guest and Kids mode cookies and device progress), When first visited, Then a short notice appears once with a link to Privacy and no tracking choices (none exist)."
21. M31-S01. Replace "As the owner" line with: "As the owner, I want a playable URL only for a signed in viewer with an active profile or for a guest session, so that videos are not freely hot-linked." Replace AC1 with: "AC1: Given an authorised profile or a guest requests playback, When the server verifies the session or guest cookie, the video visibility (published) and the kids filter, Then it returns a signed master playlist URL and a 30 minute token, with segment URLs valid for 2 hours for accounts and 20 minutes for guests." Replace AC2 with: "AC2: Given a suspended account, a hidden video, or guest play switched off, When requested, Then it returns 401 or 404 with no URL." Replace AC3 with: "AC3: Given a kids profile or a guest in Kids mode and a non-kid video, When requested, Then it returns 404."
22. M31-S02. Replace AC1 with: "AC1: Given the player requests the key, When the playback token (account or guest) is valid and the video visible, Then the 16 byte key is returned with no-store caching." Replace AC3 with: "AC3: Given key requests exceed 20 per 10 minutes per profile or guest, or 300 per minute per IP, When exceeded, Then 429."
23. M31-S03. Add Edge: "guest segment URLs live 20 minutes and account ones 2 hours. The player refreshes an expired URL through a new session (M08-S21)."
24. M35-S01. Add after AC3: "AC4: Given Kids mode is on for a guest (M40-S09), When any list is requested, Then the same query filter applies." Add Edge: "for guests the filter follows the device setting and is not a lock."
25. M35-S03. Add Edge: "guest Kids mode needs no password: it is a convenience (M40-S09)."

---

## 4. UI review

Reviewed against the audit, `docs/DESIGN-SYSTEM.md` and the checklist in `.claude/skills/angels-delight-design-system/SKILL.md`. Findings are on the current code and on the planned changes. Format: severity, file, rule, problem, fix.

### 4.1 Signed out header (`apps/web/src/components/Shell.tsx`, `app/globals.css` `.web-publicbar`)

- [Major] Shell.tsx lines 25 to 39, DESIGN-SYSTEM 11.8 and 13. Problem: the signed out header has only the logo, Sign in and Create account. No Home, Browse, My List, no search, no bottom tab bar. A guest is now a normal viewer. Fix: `GuestChrome` with `<nav aria-label="Main">`, search icon, and `<nav aria-label="Primary">` tab bar with the four tabs, hidden on the watch page, safe area padding.
- [Major] Shell.tsx. Problem: the only nav is labelled "Account", so there is no Main landmark. Fix: Main plus Primary landmarks, and keep Sign in and Create account in their own region labelled "Account".
- [Minor] Shell.tsx. Problem: Create account uses `size="sm"`. It already has `min-height: var(--touch-target)` in `components.css`, so it passes the 44 px rule. Note only: keep it at `sm`, never smaller. Result: Pass.
- [Major] `packages/ui/src/components/TopNav.tsx`. Problem: it needs `profileName` and `menu`, so it cannot render a guest. Fix: optional `guest` prop (sign in and sign up hrefs), no avatar, `overHero` and scroll states unchanged.
- [Minor] DESIGN-SYSTEM 11.8 does not describe the guest variant. Fix: add a short paragraph to 11.8 (Sign in button replaces the avatar, Create account desktop only, menu holds Kids mode and Data saver).
- Pass: skip link is first, `.web-publicbar__link` has the 44 px height, tokens only.

### 4.2 Home for guests (`app/page.tsx`, `components/home/*`)

- [Blocker] `app/page.tsx` lines 13 to 22. Problem: signed out visitors get a full page sign in card. It is the sign-up wall the owner ruled out. Fix: render Home (slice 5). The sign in card stays at `/sign-in`.
- [Major] Home. Problem: a signed out Home must not grow a sign-up banner, popup or sticky bar. Fix: none of those anywhere on Home, Title or Watch. The only prompts are the header buttons, the Save dialog and the explainer.
- [Major] Hero. Problem: Play on a hero must go straight to the watch page for a guest. Fix: `HomeHero` uses `/watch/<id>` for guests. Still image, no autoplay, data saver respected, unchanged.
- [Minor] Continue Watching for guests needs the same skeleton at card ratio after 300 ms, hidden when empty, and a quiet failure (slice 8).
- [Note] Guest data saver reads `ad.datasaver.guest`, which already exists in `lib/lowdata/preference.ts`. Guests have no playback settings page, so the menu carries the Data saver switch.

### 4.3 Title page (`components/title/TitleView.tsx`, `TitleActions.tsx`)

- [Blocker] `PublicTitle` (TitleView.tsx lines 99 to 137). Problem: no Play, and the main button says "Sign in to watch". Fix: guests use the full title view with Play. `PublicTitle` is kept only for the guest play off case.
- [Major] `TitleActions.tsx`. Problem: My List uses `useListToggle`, which queues writes in localStorage keyed by profile id. A guest must not queue anything. Fix: use the existing `toggle` prop to open the dialog. No `aria-pressed` (it is not a toggle for guests), add `aria-haspopup="dialog"`.
- [Major] Kids mode block. Problem: the existing blocked screen says "Ask a grown up to switch profiles", which does not fit a guest. Fix: "This video is not in Kids mode" with Turn off Kids mode (button) and Browse.
- [Minor] Resume label for guests is a client island. It must not shift layout: render the Play label first, swap the text without changing width, reserve the line.
- Pass: Back is on the page layout, media has an aspect ratio, tokens only.

### 4.4 Watch page (`app/watch/[videoId]/page.tsx`, `features/player/*`)

- [Major] `WatchClient.tsx`. Problem: session body sends `profileId: 'none'` and the progress and preference code assume an account. Fix: slice 2 (no profile id, local sink, no `prefsSync`).
- [Major] `WatchActions.tsx`. Problem: the label is the text "+ My List", the note is `aria-live` text only. Fix: for guests open the dialog. Keep the label rule from DESIGN-SYSTEM 14 ("Add to My List"), and use an icon from the icon set, not a typed plus.
- [Major] Player error states. Problem: `SessionError('auth')` tells the viewer to sign in. For a guest the cause is limits or an unavailable video. Fix: guest copy per state (slice 10): "Slow down a little. Try again in 20 seconds." and "We could not start this video. Try again." with Retry, and the challenge dialog.
- [Minor] The guest play off screen needs the same layout as the existing `watch__message` block with Sign in and Create account.
- Pass: reduced motion, captions and controls are untouched.

### 4.5 My List dialog (new `SignInToSaveDialog`)

Spec (DESIGN-SYSTEM 11.12): `Modal` from `@ad/ui`, centred small (480 px max) on desktop, bottom sheet with drag handle on mobile, scrim click closes (it is not destructive), Escape closes, focus moves to the heading, trapped, returns to the trigger. Copy: title "Save this to My List". Body "Sign in or create a free account to keep a list that follows you on every device. You can keep watching without one." Buttons: Sign in (primary), Create account (secondary), Not now (text). Like variant: title "Save your like", body "Sign in or create a free account to like videos and get better picks. You can keep watching without one."
- [Major] Problem to avoid: calling it an error or a block. Fix: neutral tone, no icon of a lock, no red.
- [Major] Buttons stack full width on mobile, 44 px high, primary last on desktop per 11.12.
- [Minor] Reduced motion: opacity only, no translateY. The dialog does no network call, so no loading state is needed. The Sign in link shows pressed and disabled while navigating.
- Not applicable: error state (no request), destructive confirm rules.

### 4.6 My List explainer (new `MyListExplainer`)

- [Major] DESIGN-SYSTEM 11.20 allows one primary action. The explainer has Sign in (primary) and Create account. Fix: Create account is a secondary button, Browse videos a text link. Log this as the one deliberate reading of 11.20 (sign up is the same journey).
- [Minor] The empty state anatomy: 64 px line illustration (`currentColor`, muted), H1 "My List" is the page heading, the empty headline is H2 "Save videos to watch later". Not `role="status"` (it is page content, not a response to an action).
- [Minor] When there is device history, show one link "Continue where you left off", not a row, to keep the page light.
- Pass: copy is plain and under 20 words per sentence.

### 4.7 Guest Kids toggle (new `GuestKidsToggle`)

- [Blocker] Honesty. Problem: a guest toggle with no password is not a lock, and the existing kids copy ("safe", "Exit kids mode") would imply one. Fix: label "Kids mode", help text "Shows videos made for children. Anyone using this device can turn it off." Never "locked", "protected" or "safe".
- [Major] Must be a switch (DESIGN-SYSTEM 11.2) with `role="switch"` and `aria-checked`, 44 px target, label always visible. State is shown by the badge text "Kids mode" as well as colour.
- [Major] Do not reuse `KidsExitDialog` (it asks for the account password and says exit). A separate, password free flow.
- [Minor] In Kids mode move Sign in and Create account into the menu, so a child sees no account prompts (matches M05-S06 AC2).
- [Minor] Toast on change uses `role="status"`. Error toast persists.

### 4.8 Import prompt (new `ImportPrompt`)

- [Major] Must be an inline banner, not a modal, so it never blocks the first screen a person sees after signing in. `role="region"` with an `aria-label`, focus is not stolen.
- [Major] Consent. Problem: importing silently on a shared device could put a stranger's history in an account. Fix: explicit Add them and No thanks, asked once per device, never for a kids profile, count shown in the sentence.
- [Minor] States: default, adding (button loading, width locked), success toast, partial note, error banner with Retry. Buttons stack full width on mobile, 44 px.
- [Minor] Copy: "Add the 6 videos you watched on this device to your profile?" Success: "Added 6 videos to Continue Watching".

### 4.9 Cross cutting

- No hardcoded colours, fonts or durations in any new CSS. Use `var(--token)` only and run the skill's quick greps on every slice.
- Every new component needs default, hover (inside `@media (hover: hover)`), focus (3px ring), active, disabled, loading and error, or a note saying which do not apply.
- New copy goes through `msg()` in `packages/shared/src/messages` (the `messages-coverage` test enforces it) so lane L7 can translate it. Platform name and support address come from settings.
- Existing accessibility gap worth fixing nearby: `.ad-tile:focus-visible` and `.ad-card__link:focus-visible` set `outline: none` and rely on a box shadow or an outline on a child. Both rings exist, but forced colours mode drops box shadows. Add a transparent outline (lane L8).
- Verdict for the current screens: Changes required (2 Blockers on Home and Title, 6 Majors). Verdict for the planned design: Approve with minor fixes once the mockups in section 5 are reviewed.

---

## 5. Mockup list

Numbers S80 to S89, saved as `/home/claude/ad/project/S8x_<name>.dc.html` for desktop and `S8x_<name>_m.dc.html` for mobile, matching the existing naming. Mobile first at 360 px, desktop at 1280 px. Each file shows all listed states, labelled.

| No | Screen | Desktop and mobile | States to show |
|---|---|---|---|
| S80 | Home for guests | Both | Default with hero and rows. Loading (hero and two row skeletons). Continue Watching row from this device. Empty catalog. One row failed with retry. Kids mode on (larger cards, badge). Offline banner. Data saver on |
| S81 | Signed out header and menu | Both | Default (Sign in and Create account on desktop, Sign in only on mobile). Sign up closed (Sign in only). Menu open (Kids mode switch, Data saver switch, Help, Sign in, Create account). Kids mode on (badge, account links inside menu). Over hero and scrolled solid. Search open. Keyboard focus on each control |
| S82 | Title and series page for guests | Both | Title default with Play. Resume 2:14 from this device with Start over. My List tapped (opens S83). Kids mode block screen. Guest play off (Sign in to watch). Series with Resume S1 E3 and episode progress. Loading skeleton. Not found |
| S83 | Sign in to save dialog | Desktop modal, mobile bottom sheet | My List wording. Like wording. Sign up closed (no Create account). Focus on heading, Escape closes. Navigating state on the Sign in button. Reduced motion note |
| S84 | My List explainer | Both | Default. With a device history link. Sign up closed. Kids mode on |
| S85 | Watch page for guests | Desktop, mobile portrait (landscape follows S22) | Default with My List action. Starting (poster and spinner under 3 s, then "Still loading" line). My List opens S83. Kids mode block. Guest play off. Session failed with Retry. Rate limited with wait. Offline |
| S86 | Guest Kids mode | Both | Switch off and on in the menu. Site default is Kids (switch reads "Show all videos"). Toast on change. Home in Kids mode (delta from S80). Direct link blocked screen. Failure to save with error toast |
| S87 | Limit and challenge states | Both | Slow down with countdown. Challenge dialog with the Turnstile widget placeholder. Check failed. Kids playback page (wait message, no widget). Network shared note |
| S88 | Import device history prompt | Both | Banner on Home with count. Adding. Success toast. Partial (5 of 6). Error with Retry. Not shown for a kids profile (picker context shown beside it) |
| S89 | Device storage and privacy | Both | Storage blocked note ("Your place is not being saved on this device"). Cookie and storage notice naming the guest cookie. Clear history confirm dialog (destructive pattern). Cleared state. Privacy page excerpt for the guest cookie and anonymous daily id |

Reuse tokens, header, rows and dialog styles from S14 to S20 and S22 so the mockups read as one system. Copy comes from section 3 and must pass the dash and emoji greps.

---

## 6. Decisions to log

Use the recommended option for each. Do not edit `docs/DECISIONS.md` now. At build time take the next free D-number on origin/main (the highest on origin/main today is D-168) and append each with the format of that file (the slice that first needs the decision appends it).

### G1 Guests browse and play with no account
- Options: (a) keep sign in for everything, (b) browse only, (c) browse and play.
- Recommended: (c), the owner rule.
- Why: removes the biggest drop-off, and the content is free and educational. The AES key and signed URLs still stop casual hotlinking.
- Reversible: yes. `features.guest_play` switches playback back to sign in without a deploy.

### G2 Guest identity is a signed cookie set on first play
- Options: (a) no identity, IP only, (b) signed cookie on first play, (c) cookie on first visit, (d) id kept only in localStorage.
- Recommended: (b).
- Why: per guest limits work, no cookie on pages that only browse, and the server (not the page) can set it. IP only would punish shared mobile networks. localStorage ids are not visible to the server.
- Reversible: yes. Remove the guest branch and the cookie expires.

### G3 Cookie name and key
- Options: (a) `ad_guest` with a new `GUEST_COOKIE_SECRET`, (b) `__Host-ad_guest` with a key derived from the profile cookie secret and the label `ad:guest:v1`.
- Recommended: (b).
- Why: follows the existing `__Host-` convention, and adds no new secret to the two hour launch.
- Reversible: yes. A later split key invalidates guest cookies, which only issues new ids.

### G4 Guest playback token claims
- Options: (a) fake account id, (b) `aid` = guest id with `gst: true`, `pid: null`, plus `kd` for Kids mode, never `pv`.
- Recommended: (b).
- Why: no fake account, old tokens still verify, the key limiter already uses `pid ?? aid`, and `gst` plus `pv` is refused.
- Reversible: yes.

### G5 Guest segment URL lifetime
- Options: (a) same 2 hours, (b) 20 minutes, setting `limits.guest_segment_minutes`, (c) 5 minutes.
- Recommended: (b).
- Why: shrinks the window a shared guest URL works. D-120 proved real hls.js recovers from an expired URL by minting a new session, which a guest can do because the cookie is there. Shorter than 20 minutes adds refresh traffic for little gain.
- Reversible: yes, a setting.

### G6 Where guest progress lives
- Options: (a) per video keys (today's fixture sink), (b) one key `ad:guest:progress:v1` with a cap of 100, (c) IndexedDB.
- Recommended: (b).
- Why: a cap and eviction need one place, one read is cheap on low end phones, and the format is versioned. IndexedDB adds async code for no gain at 100 small entries.
- Reversible: yes. The version field allows a migration.

### G7 Importing device history
- Options: (a) import silently on sign in, (b) ask once per device, (c) never import.
- Recommended: (b).
- Why: silent import on a shared phone can put one person's history in another's account. One question respects privacy, and the answer is remembered per device. Kids profiles are never asked.
- Reversible: yes.

### G8 Guest audience default and Kids mode meaning
- Options: (a) guests see kids only, (b) general by default with a Kids mode switch and a site setting, (c) general only.
- Recommended: (b), default `general`, setting `features.guest_audience`, cookie `__Host-ad_gaud`, with a device hint set when a kids profile is selected.
- Why: owner rule, and an honest convenience beats a false lock. Clearing cookies can always undo it, so the copy never claims protection.
- Reversible: yes. The client can set `guestAudience: kids` before launch.

### G9 Emergency switch for guest play
- Options: (a) none, (b) `features.guest_play` (default on, Super admin).
- Recommended: (b).
- Why: if the free Workers plan or the VPS is overrun, playback can go back to sign in in seconds while browsing stays open.
- Reversible: yes.

### G10 How the catalog serves guests
- Options: (a) a placeholder account and profile for guests, (b) separate guest functions sharing the same internals with no actor.
- Recommended: (b).
- Why: a fake account would sit in policies and tests as a trap. A path with no actor cannot reach RLS tables, so a bug there fails closed. The shared catalog cache keys already work by audience.
- Reversible: yes.

### G11 Public GET authentication
- Options: (a) new `/api/public/*` routes, (b) the same routes, personal path first when a session exists, guest path otherwise via `publicGuard`.
- Recommended: (b).
- Why: one URL per resource, the client code does not branch, and the personal path is untouched.
- Reversible: yes.

### G12 Challenge escalation
- Options: (a) 429 only, (b) Turnstile after 3 denials from one IP in 10 minutes when keys exist.
- Recommended: (b).
- Why: stops loops without bothering normal viewers. Turnstile is already integrated and optional. Kids playback pages never load third party scripts (SECURITY.md section 12), so they get the wait message.
- Reversible: yes.

### G13 Guest analytics identity
- Options: (a) none, guests uncounted as uniques, (b) daily hash of the guest id, (c) IP based id.
- Recommended: (b); no identity for Kids mode guests.
- Why: most viewers will be guests, so (a) would hide them. A daily rotating hash keeps the privacy promise in M19-S07. IP ids are weaker and personal data under the NDPA.
- Reversible: yes.

### G14 Search engine work split
- Options: (a) all SEO in L1, (b) robots and indexability in L1, sitemap and structured data in L6.
- Recommended: (b).
- Why: L6 owns discovery. L1 only has to make pages public and stop `/watch` and personal pages being indexed. The two lanes meet at one line in `robots.ts`.
- Reversible: yes.

### G15 How a guest is asked to sign in
- Options: (a) redirect to sign in, (b) inline banner, (c) a small dialog or sheet with Not now, and a remembered action.
- Recommended: (c).
- Why: no lost page, no wall, the pending action completes after sign in (M40-S15).
- Reversible: yes.

### G16 Hosting plan before launch
- Options: (a) stay on the Cloudflare Workers free plan, (b) move to the paid plan (about 5 USD a month) before launch.
- Recommended: (b), a budget decision for the owner.
- Why: the free plan allows about 1,200 plays a day (100,000 requests at 80 segments each). Open access reaches that sooner. The switch in G9 is the fallback.
- Reversible: yes.

---

## 7. Risks and dependencies

### 7.1 Risks

1. Kids lock is not a wall. A child on a kids-locked session who clears cookies becomes a guest on the general audience. Mitigations: selecting a kids profile sets a device hint so a lost session stays in Kids mode (M40-S09 AC5), the site default can be Kids, and all copy is honest. This remains a known limit of "no sign-up wall". Record it in SECURITY.md section 18.
2. Capacity and cost. Every play costs the VPS a session, two playlists and a key, and the edge about 80 requests. Mitigation: limits in slices 1 and 10, the shared catalog cache for guest pages, the emergency switch (G9), the paid Workers plan (G16), and a Cloudflare rate rule in DEPLOYMENT.md. Guest HTML is not edge cached (cookie varies), so the VPS serves each page. Check CPU in the load test of the final slice.
3. Scraping. A guest token is easy to get. This is deterrence, not DRM (SECURITY.md section 9). The AES key route, 20 per 10 minutes per guest and 300 per minute per IP, and the challenge are the controls. Do not describe the platform as copy protected.
4. Shared networks. Mobile carriers in Nigeria put many people behind one IP. IP limits are generous (120 sessions and 300 key requests per minute) and the per guest limit is the strict one (M23-S03 edge). Challenge triggers only after repeated denials.
5. Cookie clearing resets the guest id, so a script can dodge per guest limits. The IP limit is the backstop, then the challenge.
6. Analytics. Guest uniques are overcounted when cookies are cleared. Acceptable, and documented on the analytics screens.
7. Privacy law. The guest cookie and the anonymous daily id must be in the NDPA review brief and the Privacy page text. Counsel should confirm no consent banner is needed for strictly necessary cookies (M26-S06). Client content item.
8. Device storage. localStorage can be blocked in private mode, full, or cleared by the browser. Safari can clear script-written storage after about 7 days without a visit (likely, verify on iOS). The UI must work with an empty store and say so once (S89). Guests on iOS may lose history more often than others, which is another reason to offer sign in.
9. Service worker caching. A signed in page served from cache must never show guest chrome, and a guest page must never show a signed in profile. Mitigation: purge caches on sign in as well as sign out (slice 4) and test it.
10. Doc drift. The mismatches in 1.3 point 8 are fixed in slice 11 so the docs stop contradicting the code.

### 7.2 Dependencies on other lanes

- L2 home: `HomeView`, `HomeHero` and row components change for guests (slice 5, 8). Agree one owner of those files per week. L2's hero preview clips must respect the guest data saver key.
- L3 admin: Settings, Features gets the two new keys and the audience key. The settings registry drives the screen, so it is a one line check that they appear with the right tier.
- L4 player: `packages/player/src/http.ts` (optional `profileId`, new `SessionError('challenge')` and state), `WatchClient.tsx` (guest branch), and the end screen. L4 owns the player. L1 makes only those three small edits and lists them in the lane notes.
- L5 engagement: likes and ratings use `SignInToSaveDialog` with `reason: 'like'`, and must treat a guest as a viewer with no profile. My List caps are L5's. L5 must not add a guest write path.
- L6 discovery: search tolerance, suggestions and recent searches. Guest search must stay on the public path with no history writes. L6 owns the sitemap and VideoObject JSON-LD. Contract: `robots.ts` adds `Sitemap: <origin>/sitemap.xml` when `apps/web/src/app/sitemap.ts` exists.
- L7 languages: all new copy uses `msg()` keys, and the Kids mode, dialog and import wording needs translation review.
- L8 design: `TopNav` guest prop, the tab bar, the card focus rings, DESIGN-SYSTEM 11.8 and 11.20 notes. Mockups S80 to S89 need their review.
- L9 monetization: nothing may add a gate in front of Play for guests. Any ad or sponsor slot must follow the no wall rule and the low data rules.
- L10 account: sign in and sign up `next` handling, the profile picker landing, the kids lock exit (clears the device hint), and the place for the import prompt after sign in. L10 owns account settings. L1 owns the prompt.

Shared files that will conflict (rebase carefully): `packages/theme/src/settings-registry.ts`, `apps/web/src/app/actions.ts`, `apps/web/src/components/Shell.tsx`, `apps/web/src/components/title/TitleView.tsx`, `apps/web/src/components/home/HomeView.tsx`, `apps/web/src/features/player/WatchClient.tsx`, `packages/ui/src/components/TopNav.tsx`, `docs/USER-STORIES.md`, `docs/DECISIONS.md`, `CHANGELOG.md`.

### 7.3 Open questions for the owner

None blocks the build. Three need an owner or client answer before launch:
1. Budget for the Cloudflare Workers paid plan (G16), needed before public launch.
2. Confirm the launch default for visitors, General or Kids (G8). It is a client input (`guestAudience`) and can change any time.
3. Counsel review of the Privacy and cookie wording for the guest cookie and the anonymous daily id (risk 7).
