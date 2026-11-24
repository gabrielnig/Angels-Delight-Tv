# L10 plan: account security, downloads and big screens (module M49)

Status: planning pass, docs only. Date: 24 November 2026. Branch `plan/L10-account`. Evidence base: `docs/audits/2026-11-24-netflix-rea-audit.md` and the code paths named below. Binding rules from `CLAUDE.md` apply to every slice: tests first, scoped test runs only, ARKDEV identity, no AI attribution, no emojis, no em or en dashes, configurable client inputs, decisions logged in `docs/DECISIONS.md`.

## 1. Scope and recommended priority

| # | Item | Recommendation | Why |
|---|---|---|---|
| 1 | Viewer 2FA (optional TOTP, recovery codes) | Should, build first | Staff TOTP, recovery codes, replay guard and lockout already exist in `packages/auth`. Reuse is cheap and it is the strongest account protection for a free, no-wall platform. |
| 2 | Sign in with Google | Should, build second, fully optional | Biggest sign-up friction cut for phones in Nigeria and the diaspora. Off unless env keys exist. Apple is not needed (section 4.7). |
| 3 | Passkeys | Could, design only | Needs a new credential table and a WebAuthn library. Do after Google, only if the owner asks. |
| 4 | Per profile playback settings | Should, small delta | The page already exists (`/settings/playback`, `PlaybackSettingsForm`) with autoplay next, autoplay previews, data saver, speed, caption size, background, contrast, language. Gap: caption edge and colour, and coordination with L4. |
| 5 | Viewing activity page | Should | Genuine gap and a privacy expectation (shared family phones). Reuses `watch_progress` and `removeProgress`. |
| 6 | Offline downloads | Could. Declared not now, minimal design recorded (section 6) | Encrypted HLS, short key and URL lifetimes and iOS storage rules make it a project of its own. Wrong time before launch. |
| 7 | TV and big screens | Should, minimal: TV mode (D-pad focus navigation and large type scale). Cast and device activation Could, 10 foot redesign later | Guests can already watch with no account, so a TV browser works. The cheap win is making focus navigation reliable. |
| 8 | Account security polish | Should (sign out everywhere, new device email), Could (login history) | Mostly extends `SessionService.revokeAll` and the mailer. |

Out of scope: staff 2FA changes (already mandatory), a native app, DRM, push notifications (another lane), profile PINs (exists, M03-S12).

## 2. Current state (read from the repo)

- `packages/auth/src/totp.ts`: RFC 6238 on `node:crypto`, +/- 1 step window, replay guard through `lastUsedStep`, `otpauthUri`, `qrSvg`, ten recovery codes (`generateRecoveryCodes`, `normalizeRecoveryCode`, `hashRecoveryCode` with a pepper).
- `packages/auth/src/staff.ts` (`StaffService extends AccountService`): `adminSignIn` creates a `pending_mfa` session, `beginEnrolment`, `confirmEnrolment` (returns recovery codes and a full session), `verifyMfa`, `verifyRecoveryCode`, `twoFactorConfirmed`, `mfaLockCheck` with the `mfa:<accountId>` lockout key and `LOCKOUT_POLICIES.mfaCode`. Tables: `mfa_factors` (unique per account and type, check `type = 'totp'`, `secret_enc` under the user DEK) and `mfa_recovery_codes`.
- `AccountService.signIn` returns `signed_in`, `needs_verification`, `use_admin_login`, `pending_deletion`. There is no `mfa_required` result for viewers.
- `sessions` table has `kind` (`viewer`, `staff`, `pending_mfa`), `mfaVerifiedAt`, `reauthAt`, `ipTrunc`, `userAgent`. `SessionService.revokeAll(accountId, { exceptSessionId })` exists. No country, no new device flag.
- Accounts: `password_hash` is nullable in the column but a check constraint requires it for every non deleted account, so Google only accounts need a migration (slice 7).
- Account screens live in `apps/web/src/app/(account)`: `/account`, `/account/security`, `/account/data`, `/settings/playback`. Components in `apps/web/src/components/account` (`SecurityView`, `DevicesPanel`, `ChangePassword`, `EmailCard`, `DataPanel`, `PlaybackSettings`, `AccountNav` with four links). Copy goes through `msg()` from `@ad/shared/messages` (guarded by `messages-coverage.test.ts`). Data access goes through `getAccount()` in `apps/web/src/lib/data` with a real implementation in `apps/web/src/server/data/real-account-data.ts`.
- Progress: `watch_progress` (one row per profile and video, `position_ms`, `completed`, `updated_at`) and `watch_progress_removals` (5 minute undo store). `removeProgress` in `packages/viewer/src/progress.ts` deletes the row and keeps the old position for undo, so it already removes the title from Continue Watching.
- Playback: segment URLs live 2 hours (`SEGMENT_URL_SECONDS`), playback token 30 minutes, AES-128 key from `GET /api/hls/keys/[id]` with the bearer token only (ARCHITECTURE section 10 and 11). `ad_guest` guest access is being planned in the audit (section 5); this plan must not break it.
- PWA: `apps/web/src/app/sw.js/route.ts` builds the worker from `lib/pwa/sw-source.ts`. It never caches `/api`, playlists, segments or keys, caches posters (bounded) and an offline page, and has `CLEAR_CACHES` on sign out. Kill switch `PWA_ENABLED`.
- Env pattern for optional integrations: Turnstile keys are optional and a refinement in `packages/config/src/env.ts` demands both or neither. Google follows the same pattern.

## 3. Detailed build list

Migrations are additive. Numbers shown are the next free number at the time of writing (`0036` in `packages/db/migrations/main`); take the next free number when building and keep the `meta` journal in step. Failing test names use the repo's `describe(...)`/`it(...)` style; files are co-located with the code.

### Slice 1: Viewer 2FA service (M49-S01 to S04)

Goal: any viewer account can enrol TOTP, sign in with it, use recovery codes, disable it. No new tables.

Files:
- New `packages/auth/src/viewer-mfa.ts`: `ViewerMfaService` (constructed like `StaffService`, shares the helpers; factor the shared MFA parts of `staff.ts` into `packages/auth/src/mfa-core.ts` first, behaviour unchanged, so both services call one implementation). Methods: `status(actor)`, `beginEnrolment(actor, meta)`, `confirmEnrolment(actor, factorId, code, meta)`, `verifySignIn(pendingSession, code, meta)`, `verifyRecovery(pendingSession, code, meta)`, `regenerateRecoveryCodes(actor, password, meta)`, `disable(actor, { password, code })`, `adminReset(staffActor, accountId, reason)`.
- Edit `packages/auth/src/accounts.ts` `signIn`: after a correct password, if a confirmed `mfa_factors` row exists, create a `pending_mfa` session (10 minute life, as staff) and return `{ status: 'mfa_required', pendingToken }`. Update the result union and `packages/auth/src/index.ts` exports.
- Edit `packages/auth/src/types.ts` for the new result and audit names (`viewer.mfa_enrolled`, `viewer.mfa_disabled`, `viewer.mfa_failed`, `viewer.recovery_used`, `viewer.mfa_reset_by_admin`).
- Edit `packages/mailer/src/templates.ts`: `mfa_enabled`, `mfa_disabled`, `recovery_codes_low` (sent at 2 codes left) and `recovery_code_used`.
- Web: `apps/web/src/server/auth/gateway.ts` gains `viewerMfa` actions; `apps/web/src/app/actions.ts` gains `beginTwoFactorAction`, `confirmTwoFactorAction`, `disableTwoFactorAction`, `regenerateRecoveryAction`, `completeSignInMfaAction`. New route `apps/web/src/app/(auth)/sign-in/verify/page.tsx` (challenge: 6 digit OTP input from `@ad/ui`, "Use a recovery code" link, lockout and expired states). New `apps/web/src/components/account/TwoFactorCard.tsx`, `TwoFactorEnrol.tsx` (QR, manual key, confirm), `RecoveryCodes.tsx` (shown once, copy, download as text, "I saved them" gate). `SecurityView.tsx` renders the card. Add `getAccount().twoFactor(accountId)` to `lib/data/types.ts`, the fixture and `real-account-data.ts`.
- Admin: add "Reset 2FA" to `apps/web/src/app/admin/users/[id]` (M27) behind `admin` role, reason required, audit entry, email to the account.
- Config: `VIEWER_MFA_ENABLED` (bool, default true) so it can be switched off in an emergency. Lockout reuses `LOCKOUT_POLICIES.mfaCode`.
- Rules: staff keep the mandatory flow and the admin sign in path. A viewer with 2FA who signs in with a kids profile active still needs the factor at sign in. 2FA screens are adults only (`AdultsOnly` gate). The TOTP secret is stored encrypted under the user DEK exactly as staff.

Failing tests first:
- `packages/auth/src/mfa-core.test.ts`: `it('staff and viewer share one verify path')`, `it('rejects a replayed step')`.
- `packages/auth/src/viewer-mfa.int.test.ts`: `enrols and confirms with a valid code`, `refuses an unconfirmed factor at sign in`, `signIn returns mfa_required when a confirmed factor exists`, `signIn without a factor is unchanged`, `a pending_mfa session cannot call account routes`, `wrong code counts toward the mfa lockout`, `recovery code works once then is spent`, `regenerate needs the password and invalidates old codes`, `disable needs password and a current code`, `disable revokes other sessions`, `admin reset clears factor and codes and writes audit`, `viewer cannot reset another account`.
- `apps/web/src/server/auth/viewer-mfa-gateway.test.ts`: `pending token expires after 10 minutes`, `next param survives the challenge`.
- Component tests: `TwoFactorCard.test.tsx` (states: off, on with N codes left, low codes warning), `RecoveryCodes.test.tsx` (must tick "I saved them" to continue, copy button), `verify/page.test.tsx` (OTP auto submit at 6 digits, recovery switch, lock message, expired session message).
- Route authorization: extend the matrix test so a `pending_mfa` session gets 401 on every personal route.

### Slice 2: Security polish (M49-S12 to S14)

Files:
- Migration `0036_login_events.sql`: table `login_events (id uuid pk, account_id uuid fk cascade, session_id uuid null, at timestamptz default now(), outcome text check in ('success','failed','mfa_failed','locked'), country char(2) null, ip_trunc text, user_agent text, device_hash bytea null, new_device boolean default false)`. Index on `(account_id, at desc)`. Also add nullable `sessions.country char(2)` and `sessions.device_hash bytea`. RLS as other account tables (`packages/db/src/rls.ts` list plus `rls.test.ts`).
- Edit `packages/auth/src/sessions.ts`: `create` records `country` (from the trusted `CF-Connecting-IP`/`CF-IPCountry` header path already handled in `apps/web/src/server/auth/proxy-headers.ts`) and `device_hash` (HMAC of a long lived `ad_dev` first party cookie id, not the user agent). New `SessionService.listLoginEvents(accountId, limit)` and `revokeEverywhere(accountId, password)` wrapper (revokes including the current session, writes audit).
- New `packages/auth/src/login-events.ts` with `recordLoginEvent` and `isNewDevice`. A 90 day retention job in `packages/queue` (job `purge_login_events`, config `LOGIN_EVENT_RETENTION_DAYS`, default 90).
- Mailer: `new_device_sign_in` template (device label, country, time, "Not you? Change your password" link and "Sign out everywhere" link). Sent only for a new device hash on an account that already has at least one earlier success, rate limited to one per account per hour.
- Web: `DevicesPanel.tsx` gains the "Sign out everywhere" button (password confirm dialog, includes this device) beside the existing "Sign out all other devices". New `LoginHistoryCard.tsx` on `/account/security` (last 20 events, country and device label only, never an IP).
- Exports (`apps/web/src/server/data/export-jobs.ts`): include login events (country, time, outcome).

Failing tests first: `sessions.int.test.ts` additions (`records country and device hash`, `revokeEverywhere ends this session too`, `revokeEverywhere needs the password`); new `login-events.int.test.ts` (`records success and failure`, `new device flagged once`, `retention purges old rows`, `rls isolates accounts`); `new-device-email.test.ts` (`first ever sign in sends nothing`, `known device sends nothing`, `unknown device sends one mail per hour`); `LoginHistoryCard.test.tsx` (empty state, list, country unknown shows "Unknown place"); `DevicesPanel.test.tsx` (everywhere dialog wording and wrong password error).

### Slice 3: Viewing activity (M49-S09, S10)

Files:
- `packages/viewer/src/activity.ts` (new, exported from `index.ts`): `listActivity(ctx, actor, { profileId, cursor, limit })` returns `{ items: { videoId, seriesId?, title, episodeLabel?, watchedAt, completed, progressPct }[], nextCursor }` from `watch_progress` ordered by `updated_at desc`, keyset paginated, only published titles (unpublished titles are dropped from the list, the row remains until the user clears it). `removeActivity(ctx, actor, { profileId, videoId })` calls `removeProgress` (same undo window, so Continue Watching loses the title in one step). `clearActivity(ctx, actor, { profileId })` deletes every `watch_progress` row for the profile and its undo rows in one transaction, audit entry `viewer.activity_cleared` with a count only.
- Routes: `GET /api/profiles/[id]/activity`, `DELETE /api/profiles/[id]/activity/[videoId]`, `DELETE /api/profiles/[id]/activity`. Same `guard()` as other viewer routes, kids lock respected.
- Page: `apps/web/src/app/(account)/account/activity/page.tsx`, `loading.tsx`; components `ActivityList.tsx` (grouped by Today, Yesterday, Earlier this week, then month, using `lib/format.ts`), `ActivityRow.tsx` (poster at 16:9, title, episode, time, progress bar, Remove button), `ClearActivityDialog.tsx`. A profile selector (tabs, adults only) lets a parent view each profile; the default is the active profile. Add the link to `ACCOUNT_LINKS` (icon `clock`, label "Viewing activity") and to `pages.ts`.
- Data layer: `getAccount().activity(...)`, fixture and real versions.
- No schema change. Guests: the route is personal and returns 401. Guest progress stays on device (audit section 5) and its "Clear" lives in a small card on `/my-list` explainer, owned by the guest lane.

Failing tests first: `packages/viewer/src/activity.int.test.ts`: `lists newest first with a cursor`, `drops unpublished titles from the list`, `one entry per series episode is kept as watched`, `remove deletes the row and Continue Watching no longer shows it`, `undo within five minutes restores the position`, `clear removes every row for the profile only`, `another profile and another account are untouched`, `kids profile cannot call clear` (adults only), `clear writes an audit entry without titles`. Web: `activity-route.int.test.ts` (401 for guests, 403 for a foreign profile), `ActivityList.test.tsx` (grouping, remove shows undo toast, empty, error retry), `ClearActivityDialog.test.tsx` (focus trap, Escape cancels, confirm clears).

### Slice 4: Playback settings delta (M49-S11), with lane L4

L4 owns the player. L10 owns the settings page and the stored shape. Contract to agree before either merges: L10 adds fields to `PlaybackSettings` (`apps/web/src/lib/data/types.ts`); L4 reads them through `normalizeCaptionStyle` and `captionStyleVars` in `packages/player/src/captionStyle.ts`. Any new setting key L4 needs (skip intro automatically, theatre mode) is added by L4 to the same type in its own PR; L10 only renders what exists. Whoever merges second rebases the type.

Delta (Netflix parity from the audit: font, size, shadow, background):
- Add `captionEdge: 'none' | 'shadow' | 'outline'` (default `shadow`) and `captionColor: 'white' | 'yellow'` (default `white`). Font family stays a Could (`captionFont: 'default' | 'serif' | 'mono'`), not in this slice.
- Keep `dataSaver` as the per profile default. Add helper text that it also reduces hero rotation and previews, and show a read only note "This device is on Data saver" when `navigator.connection.saveData` is true.
- Add a live preview that uses the real caption classes (already present), a "Reset to defaults" button, and the profile name in the heading so shared devices are clear.
- Files: `packages/player/src/captionStyle.ts` (add fields, normalisation, CSS vars; owned by L4, coordinate), `apps/web/src/components/account/PlaybackSettings.tsx`, `lib/data/types.ts`, `playback.fixture.ts`, `real-account-data.ts`, `packages/shared/src/messages` copy.
- Storage: the profile settings store behind `savePlayback`; no migration expected if it is jsonb (verify; if it is columns, add an additive migration `0037_playback_caption_edge.sql`).

Failing tests first: `captionStyle.test.ts` (`normalises unknown edge to shadow`, `outline maps to text-stroke vars`, `yellow meets 4.5:1 on dark background and on none background is refused when contrast is standard`), `PlaybackSettings.test.tsx` (`edge and colour save optimistically and roll back on error`, `reset restores defaults`, `kids profile shows only data saver`), `playback.server.test.ts` (`unknown keys are ignored`).

### Slice 5: Google sign in, backend (M49-S05 to S07)

Library: `arctic` (already named in ARCHITECTURE section 3.1 as the add-beside option). Authorization code flow with PKCE and `state`, scopes `openid email profile`, ID token verified (issuer, audience, expiry, `email_verified === true`, `sub`).

Migration `0038_account_identities.sql`:
- New table `account_identities (id uuid pk, account_id uuid fk cascade, provider text check in ('google'), subject text not null, email_hash bytea not null, linked_at timestamptz default now(), last_used_at timestamptz, unique (provider, subject), unique (account_id, provider))`. Email is not stored in clear: it is held as the existing HMAC lookup hash only. RLS like other account tables.
- Replace the accounts check `accounts_active_has_credentials` so `password_hash` may be null for a non deleted account. A null hash means "no password"; `AccountService.signIn` must run the dummy verify and return the generic failure, and the "Set a password" path uses the forgot password flow.

Config (`packages/config/src/env.ts`): `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` (both or neither, same refinement style as Turnstile). Redirect URI is derived: `${APP_ORIGIN}/api/auth/google/callback`. Site setting `signInWithGoogle` (admin toggle in site settings, default on when keys exist). The button renders only when keys exist and the toggle is on; with no keys nothing changes and no Google code path is reachable (route returns 404).

Files:
- New `packages/auth/src/oauth/google.ts` (client wrapper, injectable `fetch` for tests), `packages/auth/src/oauth/link-rules.ts` (pure decision function), `packages/auth/src/oauth/service.ts` (`GoogleAuthService.begin`, `complete`, `link`, `unlink`).
- Routes: `apps/web/src/app/api/auth/google/start/route.ts` (sets short lived signed `ad_oauth` cookie with state, PKCE verifier, sanitised `next` using `next-param.ts`, and a flag `import=1` when the browser has guest progress), `.../callback/route.ts`.
- Link rules (decision D-L10-03), evaluated in `link-rules.ts`:
  1. `email_verified` false or missing: refuse, no account touched.
  2. Identity `(google, sub)` exists: sign in to that account (ignore any email change at Google, update `last_used_at`).
  3. No identity, no account with this email hash: create a verified account (no password, `email_verified_at` now, same profile bootstrap and age policy as sign up), link, sign in. The create path goes through the same terms and age consent step as email sign up (a one screen "Finish setting up" if consent is required by M01-S01).
  4. No identity, a verified password account exists: do not link silently. Show "Link Google to your account" and require the account password (or an emailed one time code if the account has no password) once; then link and sign in. This blocks account takeover through a lookalike Google account.
  5. No identity, an unverified password account exists: the Google email proves ownership, so adopt the account, clear the unverified password hash (a squatter's password dies), mark verified, link, sign in.
  6. Staff accounts (`role` not viewer) can never use Google: return the generic failure and write an audit entry.
  7. Suspended or pending deletion: same handling as password sign in (M02-S08).
  8. Viewer 2FA enabled: Google sign in still requires our TOTP or recovery code (the pending_mfa path). Simple and safe; Google's own 2 step is not trusted as ours.
- Unlink: needs another way to sign in (a password set, or another identity), otherwise refused with "Set a password first".
- Guest import interplay: the `ad:guest:progress:v1` localStorage store is read by the client after the callback lands on `next`; the callback only sets a `pending_import` hint cookie (not the data). The existing one time `POST /api/progress/import` (audit section 5, max 100 entries, fills missing or older only) runs from the same client prompt used after password sign in, so both methods behave the same. The `ad_guest` cookie is not merged server side. Nothing about guest data travels through Google.
- Security: callback rejects missing or mismatched `state`, expired cookie (10 minutes), reused code; rate limit per IP using the existing Postgres token bucket; all failures show one generic page ("We could not sign you in with Google") with a button back to `/sign-in`; audit entries `viewer.google_signin`, `viewer.google_linked`, `viewer.google_unlinked`; secrets only from env, never logged, redacted in the logger list; CSP `form-action` and `connect-src` need no Google origins because the redirect is a top level navigation and token exchange is server side.
- Mailer: "Google linked to your account" and "Google removed from your account" notices.

Failing tests first (`packages/auth/src/oauth/`):
- `link-rules.test.ts` (pure table test): `refuses unverified google email`, `existing identity wins over email change`, `new email creates account`, `verified password account needs confirmation`, `unverified password account is adopted and password cleared`, `staff role refused`, `suspended refused`, `deleted account treated as new`.
- `google.test.ts`: `rejects wrong audience`, `rejects expired id token`, `rejects bad nonce or state`, `rejects code replay`, `pkce verifier is required`.
- `service.int.test.ts`: `creates account with null password and verified email`, `second sign in reuses the identity`, `link requires password confirmation`, `unlink refused when it is the only method`, `two accounts cannot claim one sub`, `viewer with 2fa gets mfa_required after google`, `audit rows written`.
- Web: `google-routes.test.ts` (`404 when keys missing`, `callback without cookie fails generic`, `next is sanitised`), `env.test.ts` additions (`google keys must be both or neither`), `SocialButtons.test.tsx` (hidden without config).

### Slice 6: Google sign in, UI (M49-S05, S06)

- `apps/web/src/components/auth/GoogleButton.tsx` (official button anatomy: white or neutral surface, Google "G" mark inside its own SVG, label "Continue with Google"; the mark colours are the brand's own and allowed only inside that SVG, listed as an exception in `DESIGN-SYSTEM.md` section 11.26). Placed under the primary button on `/sign-in` and `/sign-up` after an "or" divider.
- New page `apps/web/src/app/(auth)/sign-in/link-google/page.tsx` (rule 4 confirmation: password field, "Send me a code instead").
- `SecurityView` gains `ConnectedSignInCard.tsx` (Google row: connected email hint like "j***@gmail.com", Unlink button, "Set a password" CTA when none).
- Tests: `GoogleButton.test.tsx` (focus ring, 44px target, disabled while redirecting, reduced motion), `link-google/page.test.tsx` (wrong password error and lockout copy, success), `ConnectedSignInCard.test.tsx`.

### Slice 7: TV mode (M49-S15, S16)

Minimal Should, one codebase, no separate route tree.
- `apps/web/src/lib/tv/detect.ts`: `isTvBrowser(userAgent)` (Tizen, Web0S or WebOS, SmartTV, Android TV `aftm`/`AFT`, `CrKey`, Hisense, Vidaa) and a stored preference `ad:tv-mode:v1` (`auto`, `on`, `off`). `/tv` is a tiny route that sets `on` and redirects to `/` (short to type with a remote). A "TV mode" switch lives in Playback settings under "This device".
- `apps/web/src/lib/tv/spatial-nav.ts`: pure `nextFocus(rects, current, direction)` (nearest candidate in the pressed direction by overlap then distance), and `useSpatialNav()` hook that, when TV mode is on, maps ArrowUp/Down/Left/Right to focus moves among `[data-focusable]` and native focusables, Enter to click, Escape and `XF86Back`/keyCode 10009 and 461 to history back, and keeps the row in view with `scrollIntoView({ block: 'nearest', inline: 'center' })`. Rows scroll horizontally when focus moves past the visible tiles. Never traps focus (a "Skip to content" and the nav row stay reachable).
- Mount in `apps/web/src/components/Shell.tsx` and the player wrapper `apps/web/src/features/player` (L4 owns the player; L10 supplies the hook and L4 wires it: Left/Right seek 10 s already exists, add Up to open controls, Enter play or pause).
- Styles: `apps/web/src/app/tv.css` loaded only when `html[data-tv]`: root font size 125% from 1280 and 150% from 1920, focus ring 4px with 4px offset plus 1.1 scale on focused tiles (transform only), hover only effects removed, hero previews and autoplay off, cards 4.3 visible, safe area 5 percent inset (overscan), no pointer cursor.
- Sign in on a TV (Could, M49-S16): `/activate` shows a 6 character code and polls; the phone opens `/activate?code=` after sign in and approves. Table `device_activations (code_hash, account_id null, expires_at, approved_at)` in migration `0039_device_activations.sql`, 10 minute life, rate limited. Not needed to watch (guests can play), so it waits.
- Cast and AirPlay (Could, M49-S17): hand to L4. Facts for them: the player uses hls.js over MSE on Chrome, so the Remote Playback API `video.remote.prompt()` does not list Cast targets for MSE playback; a real Chromecast sender needs the Cast SDK and a receiver that can fetch the key with the bearer token, so it is a separate piece of work. AirPlay works from the native HLS path on Safari with `webkitShowPlaybackTargetPicker` and is the cheap one.

Failing tests first: `spatial-nav.test.ts` (`moves right to the nearest tile in the row`, `moves down to the tile with most horizontal overlap`, `stays put at an edge`, `ignores hidden and disabled elements`), `detect.test.ts` (UA table, stored preference beats UA), `useSpatialNav.test.tsx` (`Enter activates`, `back key navigates back`, `not active when TV mode off`, `typing in the search field keeps arrows for the caret`), `tv-css.test.ts` (no outline none, ring uses tokens), `tv-route.test.ts` (`/tv sets preference and redirects`), e2e `apps/web/e2e/tv.spec.ts` (Playwright with arrow keys only: reach Play on a title from Home with no mouse).

### Slice 8 (declared not now): Offline downloads, minimal design recorded in section 6

No build in this plan. A `docs/DECISIONS.md` entry records the decision and the entry criteria. If the owner overrules, the build list is: `0040_offline_licenses.sql`, `POST /api/play/[id]/offline-license`, `apps/web/src/lib/offline/` (download manager, quota estimate, expiry), `sw-source.ts` additions (separate `ad-offline-v1` cache never trimmed by the poster limit, still wiped by `CLEAR_CACHES`), a Downloads page and a Save button on the title page. Tests would be named in the Could stories M49-S18 and S19.

### Slice 9 (Could, design only): Passkeys (M49-S08)

New `passkey_credentials` table (credential id, public key, counter, transports, label, last used), `@simplewebauthn/server` and browser, routes under `/api/auth/passkey/*`, used as a second factor first and as a password replacement later. Not built unless asked; the story records the rules so the schema choice (separate table, not `mfa_factors`, whose check pins `type = 'totp'`) is not repeated wrongly.

### Order and PR plan

1. Slice 1 (mfa-core refactor PR first, then viewer MFA, then UI). 2. Slice 2. 3. Slice 3 (independent, can run in parallel with 1 and 2). 4. Slice 4 after L4 agrees the type. 5. Slices 5 then 6. 6. Slice 7. One PR per slice, rebase on `origin/main` before each, `scripts/footprint-check.sh` before every commit, append decisions rather than rewriting.

## 4. Design detail for the harder items

### 4.1 Viewer 2FA
- Optional, per account, never nagged more than once per sign in session; a dismissible "Add a second step" card on `/account/security` only. Staff behaviour unchanged.
- Enrolment: show QR (`qrSvg`) and manual key, ask for the first 6 digit code, then show ten recovery codes once with Copy, Download and a required "I saved these codes" checkbox. Leaving without confirming does not enable 2FA.
- Sign in: after the password (or Google) the viewer lands on `/sign-in/verify` with a 6 digit OTP input (`DESIGN-SYSTEM` 11.3). Three wrong codes show the lockout message from the shared policy. "Use a recovery code" swaps the field.
- Lost phone and no codes: no self service bypass (a bypass is the weakness). Support verifies the person through the support email and an admin runs "Reset 2FA" (audited, emailed). Stated on the verify page as "Lost your phone? Contact support".
- Kids profiles never see this screen.

### 4.2 Google sign in
Covered in slice 5. Operational notes for `docs/CLIENT-INPUTS.md`: client must create a Google Cloud OAuth client (Web), add the production redirect URI, publish the consent screen (basic scopes need no verification), and hand over the two keys. Until then the button is simply absent.

### 4.3 Viewing activity
The list is the `watch_progress` table seen as history. Removing a row is the same operation as "Remove from row" on Continue Watching, so the two screens can never disagree. Trade off accepted: a completed title removed from activity also loses its "watched" tick. Reversible, no schema change. Retention of this data follows M32 (deleted with the profile or account).

### 4.4 Account security polish
Sign out everywhere (including this device, password confirmed) is distinct from the existing "sign out all other devices". New device email uses a device cookie hash, not the user agent, so a browser update does not trigger mail. Login history shows country only, never IP, to stay inside the NDPA brief.

## 5. Stories under module M49

Add to `docs/MODULES.md` (after M36): `### M49 Account security, activity and reach [READY]` with the one line purpose "Optional viewer 2FA, Google sign in, passkeys later, viewing activity, security polish, TV mode, offline downloads later." Add a "Needs from client" row: `M49 | Google OAuth client id and secret (optional), consent screen branding | Google button hidden`. Add to `docs/BUILD-PLAN.md` lane table: `L10 | M49`.

Format follows `docs/USER-STORIES.md`. Paste the block below at the end of `docs/USER-STORIES.md` under a new heading `## M49 Account security, activity and reach`.

```
### M49-S01 Turn on two step verification (Should)
As a viewer, I want to protect my account with an authenticator app, so that a stolen password is not enough.
- AC1: Given I am an adult on `/account/security`, When I choose Turn on, Then I see a QR code and a manual key, and nothing is enabled until I enter a valid 6 digit code.
- AC2: Given the code is valid, When I confirm, Then ten single-use recovery codes are shown once with Copy and Download, I must tick "I saved these codes" to finish, and I get a "Two step verification is on" email.
- AC3: Given I leave before confirming, When I return, Then two step verification is still off and the old pending secret is discarded.
- AC4: Given I am in a Kids profile, When I try to open the screen, Then I see the password gate (M35).
- Edge: starting again replaces the unconfirmed secret; the secret is stored encrypted with my user key.
- Error: an invalid code shows "That code is not right. Check the time on your phone and try again." and counts toward the code lockout.
- Empty: not applicable.

### M49-S02 Verify at sign in (Should)
As a viewer with two step verification, I want to be asked for a code at sign in, so that only I can enter.
- AC1: Given 2FA is on and my password is right, When I sign in, Then I am sent to `/sign-in/verify` and no session with account access exists until the code is accepted.
- AC2: Given a valid code, When I submit, Then I continue to `next` or `/profiles` as usual.
- AC3: Given a code already used in its 30 second window, When I submit it again, Then it is refused (replay guard).
- AC4: Given the pending sign in is older than 10 minutes, When I submit, Then I am told to start again.
- AC5: Given I signed in with Google, When 2FA is on, Then the same step applies.
- Edge: codes one step either side are accepted for clock drift.
- Error: repeated wrong codes lock the step with the shared lockout copy; the lock does not reveal whether the password was right elsewhere.
- Empty: not applicable.

### M49-S03 Recovery codes (Should)
As a viewer, I want backup codes, so that losing my phone does not lock me out.
- AC1: Given I enter a valid recovery code at the challenge, When I submit, Then I am signed in and that code can never be used again.
- AC2: Given two or fewer codes remain, When I open Security, Then a warning offers Get new codes and an email is sent once.
- AC3: Given I choose Get new codes and confirm my password, When it completes, Then ten new codes are shown once and every old code stops working.
- Edge: codes accept any case and with or without the dash.
- Error: a wrong password on regenerate counts toward lockout.
- Empty: with no unused codes the card says "No backup codes left" and offers new ones.

### M49-S04 Turn off or reset two step verification (Should)
As a viewer, I want to turn it off, and as an admin, I want to help someone who lost their phone and codes, so that nobody is locked out forever.
- AC1: Given I enter my password and a current code (or recovery code), When I choose Turn off, Then the factor and codes are deleted, my other sessions are revoked and I get an email.
- AC2: Given I am an admin on a viewer's user page, When I choose Reset two step verification and give a reason, Then the factor and codes are removed, the person is emailed, and an audit entry records who and why.
- AC3: Given I am not an admin, When I call the reset route, Then it is refused.
- Edge: staff accounts cannot turn 2FA off (it is required).
- Error: wrong password or code shows the generic message and counts toward lockout.
- Empty: not applicable.

### M49-S05 Sign in with Google (Should)
As a viewer, I want to continue with my Google account, so that I do not have to make another password.
- AC1: Given Google sign in is configured and enabled, When I open Sign in or Sign up, Then I see "Continue with Google" under the main button; when it is not configured the button is absent and the Google routes return 404.
- AC2: Given I choose it and Google returns a verified email that matches no account, When I return, Then an account is created (verified, no password), a first profile step follows, and I land on `next` or `/profiles`.
- AC3: Given Google returns an unverified email or the request fails, When I return, Then I see "We could not sign you in with Google" and a button back to Sign in, and no account is touched.
- AC4: Given the state, nonce or PKCE check fails, When I return, Then the same generic message shows and the event is logged.
- AC5: Given an account is a staff role, When Google returns its email, Then sign in is refused with the generic message and the attempt is audited.
- Edge: a Google email change does not move the identity; the Google subject is the key.
- Error: suspended or pending deletion accounts follow M02-S08.
- Empty: not applicable.

### M49-S06 Link and unlink Google (Should)
As a viewer with a password account, I want to connect Google safely, so that I can use either.
- AC1: Given Google returns an email that matches my verified password account, When I come back, Then I am asked for my password (or an emailed code if I have none) once before linking, and nothing is linked until I pass.
- AC2: Given an unverified password account exists for that email, When Google returns it verified, Then the account is adopted, its old password is cleared, and it is marked verified.
- AC3: Given I am signed in, When I choose Connect Google in Security, Then the same flow runs and the connected address shows masked.
- AC4: Given Google is my only way in, When I choose Unlink, Then I am told to set a password first.
- AC5: Given I link or unlink, When it completes, Then I get an email and an audit entry is written.
- Edge: one Google identity can belong to only one account.
- Error: wrong password on link counts toward lockout.
- Empty: not connected shows the Connect button.

### M49-S07 Guest progress after Google sign in (Should)
As a guest who watched before signing in, I want my progress kept, so that I do not lose my place.
- AC1: Given I have progress on this device and I sign in with Google, When I land, Then the same one time import prompt as after a password sign in appears (M01-S13 guest rules) and only fills missing or older entries, up to 100.
- AC2: Given I decline, When I continue, Then nothing is uploaded and the device keeps its local progress.
- Edge: the guest cookie is never merged on the server and no guest data goes to Google.
- Error: an import failure shows a retry and leaves local data intact.
- Empty: with no local progress there is no prompt.

### M49-S08 Passkeys (Could)
As a viewer, I want to sign in with my fingerprint or screen lock, so that I need no code.
- AC1: Given my device supports passkeys, When I choose Add a passkey and approve, Then it is saved with a label and listed in Security.
- AC2: Given I have a passkey, When I sign in, Then I can use it as my second step (and later in place of the password).
- AC3: Given I remove a passkey, When I confirm, Then it stops working and I get an email.
- Edge: unsupported browsers hide the control.
- Error: a cancelled prompt returns quietly to the form.
- Empty: no passkeys shows the Add button only.

### M49-S09 Viewing activity (Should)
As a viewer, I want to see what a profile watched, so that I can remove things I do not want on a shared device.
- AC1: Given I open `/account/activity`, When it loads, Then I see the active profile's titles newest first, grouped by day, with poster, title, episode, time and progress, loaded in pages of 25.
- AC2: Given I choose Remove on an entry, When it completes, Then it leaves the list and Continue Watching, an Undo toast shows for the undo window, and the title starts from the beginning next time.
- AC3: Given I have several profiles, When I choose another profile tab, Then I see that profile's list only.
- AC4: Given I am in a Kids profile, When I open the page, Then I see the password gate (M35).
- AC5: Given a title was unpublished, When the list loads, Then it is not shown.
- Edge: a series shows each episode watched with the series name.
- Error: load failure shows an inline retry card; a failed remove restores the row and shows an error toast.
- Empty: "Nothing here yet. Titles you watch will show up here." with a Browse button.

### M49-S10 Clear viewing activity (Should)
As a viewer, I want to clear a profile's whole history, so that I can start fresh.
- AC1: Given I choose Clear all and confirm in the dialog, When it completes, Then every entry for that profile is deleted, Continue Watching is empty, and an audit entry records only the count.
- AC2: Given I cancel or press Escape, When the dialog closes, Then nothing changes and focus returns to the button.
- AC3: Given I want a copy first, When I look at the page, Then a link to Download my data (M02-S05) is shown.
- Edge: other profiles are untouched.
- Error: a failure leaves the list as it was and offers retry.
- Empty: the Clear all button is hidden when the list is empty.

### M49-S11 Caption appearance and defaults (Should)
As a viewer, I want to set how captions look, so that I can read them on my screen.
- AC1: Given I open `/settings/playback`, When I change size, background, edge or colour, Then the preview updates at once, the choice saves for this profile only, and the player uses it on the next caption cue.
- AC2: Given the save fails, When the server rejects, Then the control rolls back and an error toast stays.
- AC3: Given I choose Reset to defaults, When I confirm, Then the caption choices return to defaults.
- AC4: Given the device is on Data saver, When I open the page, Then a note says so and the profile default is still editable.
- Edge: a yellow colour with no background is refused when it would fail contrast.
- Error: offline changes queue and show "Saved on this device".
- Empty: not applicable.

### M49-S12 Sign out everywhere (Should)
As a viewer, I want one button to end every session including this one, so that a lost phone is dealt with in one step.
- AC1: Given I choose Sign out everywhere and enter my password, When it completes, Then all sessions including this one end and I land on Sign in with a notice.
- AC2: Given a device is playing, When its session ends, Then playback stops at the next token refresh (5 minutes at most).
- Edge: "Sign out all other devices" stays as the milder option.
- Error: wrong password counts toward lockout.
- Empty: not applicable.

### M49-S13 New device sign in email (Should)
As a viewer, I want an email when someone signs in from a new device, so that I notice a stranger.
- AC1: Given I sign in from a device not seen before on an account that has signed in before, When it succeeds, Then I get an email with device, country and time and links to change password and sign out everywhere.
- AC2: Given a known device, When I sign in, Then no email is sent.
- AC3: Given several new devices within an hour, When they sign in, Then at most one email is sent per hour.
- Edge: the first ever sign in sends nothing.
- Error: an email failure never blocks sign in and is logged.
- Empty: not applicable.

### M49-S14 Login history (Could)
As a viewer, I want to see recent sign ins, so that I can spot anything odd.
- AC1: Given I open Security, When it loads, Then I see my last 20 sign in attempts with outcome, country, device label and time, never an IP address.
- AC2: Given entries are older than 90 days, When the job runs, Then they are deleted.
- Edge: unknown country shows "Unknown place".
- Error: load failure shows an inline retry.
- Empty: "No sign ins to show yet."

### M49-S15 TV mode (Should)
As a viewer on a smart TV browser, I want to move around with the remote, so that I can pick and play without a mouse.
- AC1: Given my browser is a known TV browser, or I open `/tv`, or I turn TV mode on, When Home loads, Then text is larger, focus is a thick visible ring on tiles and controls, and hover only effects and previews are off.
- AC2: Given TV mode is on, When I press Up, Down, Left or Right, Then focus moves to the nearest visible control in that direction and rows scroll to keep it in view.
- AC3: Given focus is on a tile, When I press Enter, Then the title opens; Back (or Escape) returns to the previous page.
- AC4: Given I am typing in a field, When I press Left or Right, Then the keys move the caret and not the focus.
- AC5: Given TV mode is off, When I use the site, Then nothing changes.
- Edge: content stays inside a 5 percent safe area.
- Error: if focus has nowhere to go, it stays and nothing is lost.
- Empty: not applicable.

### M49-S16 Sign in on a TV with a code (Could)
As a viewer, I want to approve a TV from my phone, so that I do not type a password with a remote.
- AC1: Given I open `/activate` on the TV, When it loads, Then I see a 6 character code and a short web address.
- AC2: Given I sign in on my phone and enter the code, When I approve, Then the TV signs in within 10 seconds.
- AC3: Given 10 minutes pass or 5 wrong codes are entered, When I try, Then the code is dead.
- Edge: watching never needs this; guests can play.
- Error: a failed approval shows a retry.
- Empty: not applicable.

### M49-S17 Cast and AirPlay (Could, owned by lane L4)
As a viewer, I want to send a video to my TV, so that I can watch on a big screen.
- AC1: Given my browser supports AirPlay, When I open the player, Then an AirPlay button shows and sends the stream.
- AC2: Given Chromecast is supported by a later build, When I choose Cast, Then playback moves to the TV and the phone becomes a remote.
- Edge: kids profiles keep their kids rules on the receiver.
- Error: no device found shows a one line hint.
- Empty: the button is hidden when nothing is supported.

### M49-S18 Save a title for offline (Could, not now)
As a viewer with little data, I want to save a lesson on my phone on Wi-Fi, so that I can watch it later.
- AC1: Given I use the installed app on a supported browser, When I choose Save offline on a title, Then I see the size and a storage check before it starts, and it downloads at 360p or 480p only.
- AC2: Given storage is short, When I start, Then I am told how much space is needed and what I can remove.
- AC3: Given the download completes, When I am offline, Then it plays from the device.
- Edge: at most 3 titles and 500 MB by default, both configurable.
- Error: an interrupted download resumes; a failed one shows retry.
- Empty: "No saved lessons yet."

### M49-S19 Offline licence, expiry and cleanup (Could, not now)
As the owner, I want saved lessons to expire and be removed, so that the offline copies stay controlled.
- AC1: Given a title is saved, When 14 days pass (configurable) or the viewer signs out, Then the copy and its key are deleted from the device.
- AC2: Given the title is unpublished, When the device next connects, Then the copy is removed.
- AC3: Given I open Saved lessons, When it loads, Then each shows size and days left with a Remove button.
- Edge: a Kids profile only sees kids titles.
- Error: if the licence cannot be renewed, the title says "Reconnect to keep this".
- Empty: not applicable.
```

### 5.1 Exact edits to existing stories

Apply these in `docs/USER-STORIES.md` (quote shows the line to add or change):
1. M01-S06 Sign in: add `- AC (Should): Given the account has two step verification (M49-S02), When the password is right, Then I am sent to the code step before a session is created.`
2. M01-S10 Sign out: no change.
3. M01-S11 Sign out of all devices: change the title line to `### M01-S11 Sign out of all devices (Should, see also M49-S12)` and add `- Edge: the Security screen also offers "Sign out everywhere" including this device (M49-S12).` The existing Edge list of sessions with country is realised by M49-S13 (country recorded on the session).
4. M01-S13 Return to intended page: add `- Edge: with Google sign in (M49-S05) the next value travels in a short lived signed cookie and is sanitised the same way.`
5. M02-S01 View account overview: AC1 link list becomes `links to Security, Playback, Viewing activity, Data and Privacy.`
6. M02-S04 Playback and display settings per profile: in the title and AC1 keep as is and add `- AC4 (Should): Given I open the screen, When I look at captions, Then I can also set edge and colour and see a live preview (M49-S11).` Add `- Edge: "Reset to defaults" restores caption choices.` Replace `speed memory` in the story sentence with `default speed`, to match the screen.
7. M02-S05 Export my data: AC1 file contents become `account, profiles, list items, progress, viewing activity, linked sign in methods (provider only) and recent sign in events (country, time, outcome).`
8. M02-S06 Delete my account: add to AC3 `, linked sign in identities and login events` after `list data`.
9. M09-S07 Remove from row: add `- Edge: the same removal is available from Viewing activity (M49-S09) and has the same undo window.`
10. M03-S12 and M35 kids stories: add one line to M35 `- AC: Given a Kids profile is active, When any M49 account screen (security, activity) is requested, Then the password gate shows; playback settings stay available with only Data saver and caption appearance unlocked.`
11. M12 Admin auth and roles: add `- Edge: Google sign in is never available for staff roles (M49-S05 AC5).`
12. M21 Notifications and email: add templates `mfa_enabled`, `mfa_disabled`, `recovery_codes_low`, `recovery_code_used`, `new_device_sign_in`, `google_linked`, `google_unlinked`.
13. M25 PWA and low-data: add `- Edge: offline downloads (M49-S18) are not part of M25; the worker never caches playlists, segments or keys until M49-S18 is built.`
14. `docs/SCREEN-ARCHITECTURE.md`: add screens S170 to S179 (section 8), routes `/sign-in/verify`, `/sign-in/link-google`, `/account/activity`, `/tv`, `/activate`, and extend S28 with the 2FA card, connected sign in card, login history and the sign out everywhere dialog.
15. `docs/SECURITY.md`: section 3 (auth) add viewer optional TOTP and the Google rules; capability table add the activity routes; section 11 secrets add `GOOGLE_CLIENT_SECRET`; section 12 NDPA notes add login events (country only, 90 days).
16. `docs/ARCHITECTURE.md` section 3.1 and line 102 ("no social login is needed at launch"): replace with "Google sign in is optional and uses arctic beside the custom sessions; see D-L10-03".

## 6. Offline downloads: feasibility and recommendation

Verdict: Could, not now. A minimal design is recorded so a later lane can build it without redoing the research.

Findings:
- Encrypted HLS: segments are AES-128 and the key comes from `/api/hls/keys/[id]` with a 30 minute bearer token. Offline play needs the key stored on the device. That is no weaker than today (a logged in viewer can already capture the stream; ARCHITECTURE section 10 says this is not DRM), but it makes a permanent copy, so it needs a new licence endpoint with its own lifetime and a revocation story.
- Segment URLs are signed for 2 hours (`SEGMENT_URL_SECONDS`). Downloads must fetch within that window or ask for fresh playlists per batch; the download manager must refresh playlists, and the cached copy must be served by the worker from a rewritten playlist (hls.js over MSE cannot read Cache Storage by itself; the worker answers `fetch` for the rewritten URLs).
- Storage: the Cache Storage API is available on Android Chrome with a per origin quota that is a large share of free disk (Chromium bases it on disk size; treat roughly half or more as the working figure and always read `navigator.storage.estimate()`). iOS Safari limits browser tabs to a smaller share and evicts script writable storage after about 7 days without use unless the site is added to the Home Screen; installed web apps get larger limits and are exempt from that eviction. `navigator.storage.persist()` helps on Chrome and is only a hint on Safari. Quota numbers vary by version and must be checked against current vendor documentation when this is built.
- Size: the encoding ladder at 360p and 480p keeps a 20 minute lesson near 40 to 90 MB, so a 500 MB cap holds about 5 to 10 lessons; the recommended default of 3 titles stays well inside it.
- Background fetch on iOS is not available, so a download only proceeds while the app is open on iOS. Android Chrome has Background Fetch.
- The worker is deliberately conservative today (never caches media or `/api`, wipes on sign out). Offline media needs its own cache namespace excluded from the poster trimming, still wiped on sign out, profile switch to a kids profile with different rules, and unpublish.

Minimal design if later approved: Android Chrome and installed iOS PWAs only; 360p and 480p only; max 3 titles and 500 MB (config keys `OFFLINE_MAX_TITLES`, `OFFLINE_MAX_MB`, `OFFLINE_EXPIRY_DAYS` default 14); storage estimate prompt before start; `POST /api/play/[id]/offline-license` returns a signed licence (account, profile, video, exp) plus the key wrapped to the licence; licence checked by the worker on each play, renewed silently when online; signed out or unpublished deletes the copy; analytics counts offline plays when reconnecting.

Reasons for not now: launch is about the free streaming path and the Workers free plan is already a constraint; offline needs storage, key and unpublish handling that touch security review items; most Nigerian viewers on Android are better served first by Data saver, 360p default and resume, which exist. Revisit when real usage shows repeat viewing of the same lessons on weak networks.

## 7. UI review of the account and settings screens

Reviewed against the audit (sections 3 and 4), `docs/DESIGN-SYSTEM.md` and the `angels-delight-design-system` skill checklist (tokens, states, focus, touch targets, copy, reduced motion). Findings are concrete and each maps to a slice or a small fix PR.

1. Navigation gap. `ACCOUNT_LINKS` (`AccountNav.tsx`) has four items and no place for Viewing activity or login history. Fix in slice 3: add the item; on mobile the pill tab row must scroll horizontally with a visible peek of the next pill rather than wrap (check `account.css` at 360 px).
2. Sign out wording mismatch. `DevicesPanel.tsx` offers only "Sign out all other devices" while M01-S11 promises "Sign out everywhere" with a password. Slice 2 adds the second button and a confirm dialog; keep the two visually distinct (danger-outline versus danger) and the dialog must trap focus, close on Escape and return focus.
3. Device labels guessed from a regex. `isDesktop(label)` in `DevicesPanel.tsx` picks the icon from a text match. Replace with a `kind` field from the server (`phone`, `tablet`, `desktop`, `tv`) so TV sessions get a TV icon (needs the `tv` glyph added to `icons.tsx`, 24 px, stroke style as siblings).
4. Raw pixel values in `account.css` (for example `6px`, `2px`, `52px` min height on line 1380, `4.5rem`, `border-radius: 6px`) break the 4 px rhythm and radius tokens (`4, 8, 12, 16`). Replace with spacing and radius tokens in the same PR that touches each block; run the skill grep for raw px.
5. Touch targets. Most controls use `--touch-target`; verify the small secondary "Sign out" per device row, the toggle rows in `PlaybackSettings`, and the new Remove button on activity rows at 44 px with at least 8 px between neighbours.
6. Focus. Account CSS uses the 3 px ring with 2 px offset (lines 311, 417, 701) which matches tokens. The audit flagged `.ad-tile:focus-visible { outline: none }`; the TV mode ring (4 px, scaled tile) must not depend on that rule, so slice 7 fixes the tile ring first.
7. Playback settings. Good: instant optimistic save, kids lock rows, live caption preview. Gaps: no Reset, no edge or colour (slice 4), no explanation of how Data saver interacts with hero and previews, no per device note when the browser reports `saveData`. The preview text "Plants make food using sunlight." is fine; keep a second line sample to show wrapping at large size.
8. Security page. Currently Password, Email, Devices. With slices 1, 2, 5 it becomes six cards; order them by urgency: Password, Two step verification, Connected sign in, Email, Devices, Login history. On desktop use a single column at max 40rem (cards, not a grid) so the page scans like Netflix account pages; on mobile each card is collapsed to its summary row with a chevron to expand, to avoid a long scroll.
9. Data and privacy. Delete account uses typed DELETE (good, matches M02-S06). Add the link to Viewing activity and a sentence that clearing activity does not delete the account. Export success and failure copy must be one sentence plus one action (audit section 3).
10. Copy rules. All new strings through `msg()` with entries in `@ad/shared/messages`; no blame ("That code is not right"), no em or en dashes, no emoji, sentence case, no jargon ("Two step verification" not "TOTP"; mention "authenticator app" once). Google button label is exactly "Continue with Google".
11. States to build for every new component: loading skeleton at the final layout, empty, error with Retry, success toast (polite live region) and persistent error notice (assertive), disabled while pending, reduced motion (no slide in of dialogs, use opacity only), `hover: hover` guard on hover styles.
12. Colour. The Google mark is the only place raw brand colours are allowed (inline SVG); add that exception to `DESIGN-SYSTEM.md` 11.26 and make the skill grep ignore `GoogleMark.tsx`. Caption colour yellow is a caption token, not a theme token, and must be declared in `packages/player` styles via variables.
13. Account layout. `(account)/layout.tsx` calls `requireProfile`, so the whole area is closed to guests, which is correct, but the signed out header link "Account" must not appear for guests (guest lane). Activity page copy for guests is covered by the `/my-list` explainer, not a redirect loop.
14. Accessibility. The OTP input needs `autocomplete="one-time-code"`, `inputmode="numeric"`, a single labelled group for the six cells or one field with a visual split, paste support and screen reader label "6 digit code". The QR needs a text alternative (the manual key) beside it. Recovery codes use a monospace token font via `var(--font-mono)` (confirm it exists, else add to tokens, not a literal).
15. Big screens. At 1920 the account pages should stay at a readable measure (max 40rem content) and not stretch; in TV mode the account area is reachable but not optimised (sign out and settings only).

## 8. Mockup list (S170 to S179)

Each is a `.dc.html` in the design project folder, mobile (390) and desktop (1280) frames, dark and light where the account skin differs, all states shown side by side.

| Id | Screen | States to draw |
|---|---|---|
| S170 | Security overview with new cards | all cards collapsed (mobile) and expanded (desktop); 2FA off, on, low codes warning; connected sign in with Google linked and not linked; login history list and empty; loading skeleton; error card |
| S171 | Turn on two step verification | step 1 scan QR with manual key and copy; step 2 enter code (empty, typing, wrong, locked); success; cancel confirm |
| S172 | Recovery codes and sign in challenge | recovery codes grid with Copy, Download, "I saved these" gate; `/sign-in/verify` OTP (idle, wrong code, locked, expired); recovery code entry; "Lost your phone" help text |
| S173 | Google sign in | Sign in and Sign up with the Google button and "or" divider; redirecting state; link-google password confirmation (idle, wrong password, locked); generic failure page; button absent when not configured |
| S174 | Viewing activity | grouped list; hover and focus row; remove with Undo toast; clear all dialog; empty; loading; error; profile tabs; Kids password gate |
| S175 | Playback settings update | caption edge and colour pickers with live preview at three sizes; Reset to defaults dialog; Data saver device note; Kids locked variant; save error rollback |
| S176 | Sign out everywhere and device list | dialog with password; device rows with phone, laptop, TV icons; this device badge; success notice; wrong password |
| S177 | TV mode (1920 by 1080) | Home with focus ring on a tile and the row scrolled; Title page focus on Play; Player controls shown by Up; safe area overlay; focus never lost on an empty row; `/activate` code screen |
| S178 | Offline downloads (Could, not now) | title page Save offline button; storage check sheet (enough, short, unsupported); Saved lessons list with days left; expired notice; progress and paused states |
| S179 | Passkeys (Could, not now) | Add passkey sheet; list with labels and last used; remove confirm; unsupported browser state |

Use the existing account skin (`soft`) from S66 as the base; copy words in the mockups must match the story copy above.

## 9. Decisions to log in `docs/DECISIONS.md` (recommended option taken)

Use the next free D-number at build time (highest on main now is D-168). Each entry: decision, options, why, reversible.

- D-L10-01 Viewer 2FA is optional TOTP reusing the staff implementation, with recovery codes and no self service bypass; admin reset is audited. Options: SMS codes (rejected: cost, SIM swap), email codes (rejected: same inbox as password reset), TOTP (chosen). Reversible yes (feature flag `VIEWER_MFA_ENABLED`).
- D-L10-02 2FA stays required for staff and is never offered as the only factor for kids profiles (adult screens only). Reversible yes.
- D-L10-03 Google sign in only, optional, via `arctic` beside custom sessions; both keys or none; hidden when absent. Account linking rules as in slice 5 (verified email only, password confirmation to link to an existing verified account, adopt unverified, staff excluded, our 2FA still applies). Options: Auth.js (rejected earlier, D in ARCHITECTURE 3.1), auto link by email (rejected: takeover risk). Reversible yes; the identity table is additive.
- D-L10-04 Apple sign in is not built. Apple's rule that requires it applies to native App Store apps offering other social logins; this is a web app and PWA. Revisit if a native wrapper is ever shipped. Reversible yes.
- D-L10-05 Google only accounts have a null password hash; the accounts credential check is relaxed by migration. Option: store a random unusable hash (rejected: hides a real state). Reversible with a migration.
- D-L10-06 Passkeys are Could and use their own table, not `mfa_factors`. Reversible yes.
- D-L10-07 Viewing activity is the `watch_progress` table; removing an entry equals removing it from Continue Watching and resets position; clearing deletes the rows. Option: separate immutable history table (rejected: more data kept, more NDPA surface). Reversible yes.
- D-L10-08 Activity and security screens are adults only; a parent views each profile through tabs. Reversible yes.
- D-L10-09 Playback settings page already exists; this lane adds caption edge and colour only, and L4 consumes them. Font family is deferred. Reversible yes.
- D-L10-10 Offline downloads are declared not now with the minimal design in section 6 and entry criteria. Reversible yes.
- D-L10-11 TV mode is a progressive enhancement in the existing app (auto detect, `/tv`, preference), not a separate 10 foot product. Reversible yes.
- D-L10-12 Cast is deferred; AirPlay is the cheap first step and belongs to L4. Reversible yes.
- D-L10-13 New device email keys off a first party device cookie hash and country only; login events kept 90 days (`LOGIN_EVENT_RETENTION_DAYS`). Reversible yes.
- D-L10-14 Sign out everywhere requires the password and ends the current session; "sign out other devices" remains. Reversible yes.
- D-L10-15 TV sign in by code is Could. Reversible yes.

## 10. Risks and dependencies

Dependencies:
- L4 (player): caption style fields, the TV key handling inside the player, AirPlay and Cast. Agree the `PlaybackSettings` type change first (slice 4) and who merges first.
- Guest access lane (audit section 5): `Viewer` union, `/api/progress/import`, `ad_guest` cookie, `next` handling. Slices 3 and 5 only rely on the import endpoint existing; if it is not merged, S07 is built behind the same client hook and ships dark.
- Notifications and mailer (M21) for the seven new templates; email domain and Brevo or SMTP setup are client inputs and the app already has a no email interim mode (D-163 to D-165), so 2FA enabling must not depend on email delivery (emails are notices only).
- Admin users screen (M27) for the Reset 2FA action.
- DB: three or four new migrations (login events, identities and the credentials check, optional caption fields, optional device activations). Numbers will race with other lanes; renumber on rebase.
- Client: Google Cloud OAuth client and keys (optional). Add to `docs/CLIENT-INPUTS.md`.

Risks:
- Lockout of viewers who lose their phone and codes. Mitigation: codes shown with a required confirm, low code warning, audited admin reset, clear copy.
- Account takeover through linking. Mitigation: verified email only, password proof for existing accounts, staff excluded, tests for every rule.
- Pre-hijacking by a squatter on an unverified account. Mitigation: rule 5 clears the squatter's password.
- Refactor risk in extracting `mfa-core.ts` from `StaffService`. Mitigation: refactor PR with no behaviour change and the existing `staff.int.test.ts`, `staff-recovery.int.test.ts` and `totp.test.ts` green first.
- Google outage or blocked domain: password sign in is unaffected; the button failure page offers the normal form.
- Spatial navigation edge cases on old TV browsers (Tizen, WebOS ship older Chromium versions): keep the code ES2019, avoid newer APIs, test with a Chromium 76 profile in Playwright if available, and ship TV mode as opt in on first release if a real device is not available.
- `watch_progress` as history loses completed ticks when removed and cannot show re-watches. Accepted in D-L10-07.
- Downloads: the work is large and security sensitive; keeping it out of this release is the main mitigation.
- Cloudflare Workers free plan limits (audit section 5) are not affected by this lane.
- Copy and locale: new strings must be added to the message catalogue so later translation (Yoruba, Igbo, Hausa, Pidgin) works.

## 11. Owner questions

1. Do you want Google sign in live at launch? It needs a Google Cloud OAuth client created under the platform's Google account (the plan makes it optional and invisible until keys exist).
2. For a viewer who loses both phone and recovery codes, is "contact support, an admin resets after checking" acceptable, and who on the team is allowed to do it (admin role only is the recommendation)?
