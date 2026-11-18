# Decisions Log

Format: decision, options considered, why, reversible or not. Newest first. Decisions that need the owner are decided here with the recommended option, then flagged for confirmation.

## D-001 Commit identity and merge style
- Decision: all commits authored and committed as ARKDEV, PRs merged with rebase merge so each commit keeps its author.
- Options: squash merge, merge commit, rebase merge.
- Why: squash and merge commits are authored by the token owner on GitHub, which breaks the ARKDEV rule. Verify after the first PR.
- Reversible: yes.

## D-002 Dummy content until the client supplies videos
- Decision: seed placeholder titles and generated sample clips so every screen can be built and tested.
- Why: content is a client dependency.
- Reversible: yes.

## D-003 Brand tokens
- Decision: document colours (off-white `#F5F5F2`, ink `#1A1C22`, banner blue `#1F6FB5`, accent yellow `#FFC93C`) are default theme values stored in the database and overridable from admin.
- Reversible: yes.

## D-004 Playback and account defaults
- Decision: resume 3 seconds back, ignore progress under 5 seconds, finished at 95 percent or 10 seconds left. Up to 5 profiles per account. Lockout after 5 failures in 15 minutes for 15 minutes (admin: 3 failures, 30 minutes).
- Why: sensible defaults from PRD section 8, all configurable. Reversible: yes.

## D-005 Captions gate and admin roles
- Decision: an approved caption track is required to publish (Admin can override with a reason). Roles: Super admin, Admin, Editor, Analyst, all with TOTP 2FA.
- Reversible: yes.

## D-006 Upload limits
- Decision: 8 MB parts, 3 in parallel, 5 GB per file, 2 files at once.
- Reversible: yes.

## D-007 Design system choices
- Decision: yellow is never text on light surfaces (1.41:1). Input border `#8A8D94` (3.04:1). No hover video previews and a still hero image for low data. Fonts limited to Inter, DM Sans, Poppins, Nunito, Lora, self-hosted. Theme editor blocks saving when text fails 4.5:1.
- Reversible: yes.

## D-008 Engineering defaults
- Decision: custom database-backed sessions (not Auth.js); argon2id; mandatory TOTP for staff roles; Postgres token-bucket rate limiting (no Redis); pg-boss queue; one S3 driver for R2 and MinIO plus a local driver for tests; three buckets (originals, media, backups).
- Reversible: moderate cost for auth, cheap for the rest.

## D-009 Video delivery
- Decision: HLS MPEG-TS, 6 second segments, AES-128 with one key per video wrapped by `HLS_KEK`; playlists served by the app, segments through a Cloudflare Worker with HMAC signed URLs; stateless playback token, 30 minute life.
- Why: DRM-free protection that works with the free Cloudflare plan for the first stage (about 1,200 plays per day before the paid Workers plan).
- Reversible: yes.

## D-010 Captions and data lifecycle
- Decision: faster-whisper small.en as a separate service; captions stored as revisions needing approval; per-user keys in a separate keys database, email stored as HMAC lookup hash plus ciphertext; fail-closed row level security on accounts, profiles, watch_progress, my_list.
- Reversible: yes.

## D-011 TLS minimum
- Decision: Cloudflare TLS 1.3 enabled with minimum 1.2, so older Android devices keep working.

## D-012 Test running in CI
- Decision: CI runs only tests affected by the PR (`vitest run --changed origin/main`). The nightly full-suite job is NOT enabled for now, to respect the rule of never running the full suite. Reconsider with the owner before launch.
- Reversible: yes.

## D-013 Self-healing pipeline
- Decision: advisory only. A human applies fixes and commits as ARKDEV.

## D-014 Package layout in lane A
- Decision: `packages/config` holds the Zod env loaders (ARCHITECTURE listed tsconfig and eslint bases there; those live at the repo root as `tsconfig.base.json` and `eslint.config.js`). `packages/ui` exists from lane A (tokens plus theme helper). Hashing, HMAC and AES-GCM helpers live in `packages/shared` until lane B builds `packages/crypto` on them. `queue` and `video` packages wait for lane D. Workspace packages ship TypeScript source with no build step.
- Options: follow ARCHITECTURE section 4 literally, or follow the lane A brief.
- Why: the lane A brief names config, ui and shared this way, and root level config files are the normal pnpm monorepo shape. ARCHITECTURE section 4 is updated to match.
- Reversible: yes, cheap while few files import them.

## D-015 Compose file name
- Decision: `docker-compose.yml` at the repo root, not `compose.yaml`.
- Why: the lane A brief names it. Both are read by Compose v2. DEV-SETUP, DEPLOYMENT references to the dev file are updated. Production stays `compose.prod.yaml`.
- Reversible: yes.

## D-016 Upload defaults
- Decision: `UPLOAD_PART_BYTES` 8 MiB (minimum 5 MiB, the S3 floor) and `MAX_UPLOAD_BYTES` 5 GiB, as in D-006. ARCHITECTURE section 15 had 16 MiB and 4 GiB.
- Why: D-006 is a logged decision and the env table was written before it. ARCHITECTURE updated.
- Reversible: yes, env values.

## D-017 Object storage image for local development
- Decision: compose reads `MINIO_IMAGE` and `MC_IMAGE`, defaulting to the quay.io tags `RELEASE.2025-04-22T22-12-26Z` and `RELEASE.2025-04-16T18-13-26Z`. These were not pulled in the lane A environment (no Docker daemon). `minio/minio` and `minio/mc` returned not found on Docker Hub on 2026-11-17. `STORAGE_DRIVER=local` is the zero container fallback and has a full contract test suite.
- Options: RustFS (published on Docker Hub, 1.0.6 on 2026-11-15), Garage (no bucket policy API), SeaweedFS, building MinIO from source.
- Why: keeps the documented service names working while the owner verifies an image. Needs confirmation at the first `docker compose up` on a machine with Docker.
- Reversible: yes.

## D-018 withAccount signature and RLS context helpers
- Decision: `withAccount(db, { accountId, role }, fn)` where `db` is any Drizzle database with `transaction`. Policies use `app_account_id()` and `app_actor_role()`, which turn an empty string into NULL.
- Why: with pooled connections `current_setting('app.account_id', true)` returns an empty string, not NULL, after an earlier transaction set it, and `''::uuid` raises. A test covers this exact case. Passing `db` keeps the helper free of a module level singleton.
- Reversible: yes.

## D-019 pg-boss schema ownership
- Decision: migration 0005 creates the `pgboss` schema and grants. The worker starts pg-boss with `createSchema: false` and still lets it create its own tables (it has CREATE on that schema). `ad_migrator` is a member of `ad_worker` so the migration can set default privileges that give `ad_app` DML on the tables pg-boss creates.
- Options: give `ad_worker` CREATE on the database, or run pg-boss installation from the migrator.
- Why: least privilege. A test boots pg-boss as `ad_worker` and then reads `pgboss.job` as `ad_app`. Queue partitions created later by the worker are covered by the same default privileges, lane D should confirm this when it adds queues.
- Reversible: yes.

## D-020 Integration tests and the commit hook
- Decision: `*.int.test.ts` files run in the normal Vitest projects and skip themselves unless `TEST_DATABASE_ADMIN_URL` is set. CI sets it through a Postgres service container. The pre-commit hook runs `vitest related --run` on staged source files but skips `*config.ts`, because Vitest reruns every test when a config file changes.
- Why: one config per package, no second integration project, and the hook cannot trigger the whole suite. The first commit of this branch did trigger it once before the config filter existed.
- Reversible: yes.

## D-021 Keys database migrations
- Decision: `user_keys` has its own drizzle config and migrations folder (`packages/db/migrations/keys`). `KEYS_DATABASE_URL_MIGRATE` is a new optional variable for the owner role on that database. The migrate CLI runs the keys migrations only when it is set.
- Why: DATA-MODEL puts `user_keys` in a separate database with separate credentials. `ad_keys_shred` gets column level SELECT on `account_id` because a DELETE with a WHERE clause needs it, and nothing else.
- Reversible: yes.

## D-022 Container runtime mode
- Decision: web and worker images run with `NODE_ENV=production` (Next's standalone server forces it). The production rules in `packages/config` apply in the `full` compose profile, so local https through the `proxy` profile is needed there. Day to day development runs the apps on the host.
- Why: closest to production, and the rules (https origins, no local driver, no DEV_SKIP_MFA) are security controls worth exercising.
- Reversible: yes.

## D-023 Tooling pins
- Decision: TypeScript 5.9 (7.x exists but typescript-eslint supports below 6.1), ESLint 9 (`@eslint/js` 9), Next 16, React 19, Vitest 5, Drizzle ORM 0.45, pg-boss 12, Zod 4, Prettier 3. pnpm 10.28 pinned in `packageManager`. `next dev` writes `apps/web/AGENTS.md` (text with an em dash), which is git ignored so it is never committed.
- Reversible: yes.

## D-024 View event privacy constraint
- Decision: an extra CHECK on `view_events` rejects a non null `profile_id` when `audience = 'kids'`, enforcing "always null for kids profiles" in the database as well as the service.
- Reversible: yes.

## D-025 Admin UI role model
- Decision: the admin UI authorizes with the three database roles (viewer, editor, admin) through one `can(role, action)` table in `apps/web/src/lib/admin/can.ts`, taken from docs/SECURITY.md section 5. Screens marked "Super admin" in SCREEN-ARCHITECTURE (roles, system, purge from trash, site feature flags) are admin only for now. "Analyst" is treated as read only analytics and is not a separate role yet.
- Options: add super_admin and analyst to the account_role enum now, or keep three roles and map.
- Why: D-005 lists four staff roles but the schema has three and an enum change touches lane B auth. The table is the single place to extend when the enum grows.
- Reversible: yes, one file plus a migration.

## D-026 Upload engine shape
- Decision: the client upload engine is a framework free module (`apps/web/src/lib/uploader`) driven by an `UploadTransport` seam (start, uploadPart, complete, abort). Resume is part level from server truth: `start` with a known upload id returns the parts already stored, so Retry and a re-picked file send only the missing parts. Defaults: 2 files at once, 3 parts per file, 4 automatic attempts per part with exponential backoff (1s base, 30s cap), then the lane fails with "N percent was saved" and a manual Retry. Offline lanes wait for the network and resume without using attempts.
- Options: byte range resume inside a part (not possible with S3 multipart), tus protocol (extra server).
- Why: matches docs/ARCHITECTURE.md section 7 and D-006. The fake transport lets the screens run before the API lane merges.

## D-027 Video pipeline package layout and testing seams
- Decision: lane D code lives in `packages/video` (pure pipeline logic plus services with narrow store interfaces), `packages/queue` (pg-boss helpers), `apps/whisper` (Python HTTP service), `apps/edge` (Cloudflare Worker). Services take small interfaces (storage, stores, runners) so unit tests use fakes, and Drizzle implementations are covered by `*.int.test.ts` files.
- Options: put everything in `apps/worker` and `apps/web`.
- Why: web and worker both need the same signing, playlist and upload rules, and ARCHITECTURE section 4 already names these packages. Packages never import apps.
- Reversible: yes.

## D-028 HLS KEK rotation and playback token key ids
- Decision: `video_keys.kek_version` is always 1. Unwrapping tries `HLS_KEK` then `HLS_KEK_PREVIOUS`, AES-GCM with the video id as associated data makes a wrong key fail closed. Playback token `kid` is the first 6 base64url characters of SHA-256 of the secret, so rotation needs no extra setting.
- Options: a numeric key version in config, a stored key id per row.
- Why: no new environment variables and nothing to keep in step by hand. A rotation sets `HLS_KEK_PREVIOUS`, runs the rewrap helper, then removes it.
- Reversible: yes.

## D-029 Permanent job failures complete the pg-boss job
- Decision: when a handler hits a permanent error (bad file, wrong format) it writes `failed_permanent` and the plain reason to the `jobs` mirror and the video, then returns normally so pg-boss does not retry. Transient errors throw and pg-boss retries with backoff, and the mirror shows `failed` after the last attempt.
- Options: `boss.fail` with a dead letter queue.
- Why: no retries wasted on input that can never work, and the admin screens read the mirror, not pg-boss tables. ARCHITECTURE section 13 asked to verify the call in the pinned version, this needs no special call.
- Reversible: yes.

## D-030 Signed media url covers the object key, not the host
- Decision: `sig = base64url(HMAC_SHA256(MEDIA_URL_SECRET, objectKey + "\n" + exp))` where `objectKey` is `v/{prefix}/{height}/seg_N.ts`. The media origin may carry a base path in dev (`http://localhost:9000/ad-media`), so the verifier strips its own mount prefix to recover the key.
- Options: sign the full pathname.
- Why: the same signature works on the Cloudflare Worker (path is the key), on MinIO behind a prefix and on the local dev route.
- Reversible: yes.
## D-031 Theme save gate thresholds (lane H)
- Decision: ink and muted text on the page and card colours below 4.5:1 block save and publish (D-007). Button text is auto chosen as white or ink (whichever is higher): below 2:1 blocks, 2 to 4.5 warns, and the admin must confirm warnings to publish (recorded in the audit entry). Primary as link text on the page below 4.5 only warns. Border strong and focus rings are auto derived to reach 3:1, never shown as failures. Lora is applied to `--font-display` only, body stays Inter.
- Options: block everything under 4.5 (too strict for brand colours that pass with the other text colour), warn only (breaks D-007).
- Why: matches DESIGN-SYSTEM 4.3, M18-S02 and the S56 mockup states.
- Reversible: yes, thresholds are constants in `packages/theme/src/gate.ts`.

## D-032 Logo and favicon upload format (lane H)
- Decision: logo and favicon uploads accept PNG, JPEG or WebP up to 500 KB, sniffed by magic bytes, decoded and re-encoded to WebP with `sharp` (logo widths 160, 320, 640 without upscaling, favicon 32, 192, 512 square), metadata stripped, animation rejected. SVG is rejected.
- Options: accept sanitised SVG (needs the `assets.mime` check and DATA-MODEL changed, and a second sanitiser to trust), accept SVG only as text.
- Why: SECURITY.md section 11 and DATA-MODEL 5.4 say SVG is not an allowed type. M18-S05 mentions SVG, the docs win until the owner asks. A high resolution PNG covers the same need.
- Reversible: yes, a sanitiser and a mime in the assets check can be added later.

## D-033 Theme history model (lane H)
- Decision: there is no `theme_versions` table. `theme_settings` rows are the versions. Save draft updates the single draft in place. Publish archives the previous published row and promotes the draft with the same version number. Restore and reset archive the current draft (so it stays in history as a draft) and insert a new draft with the next version. History lists every row, 20 per page, newest first, status shown as published when `published_at` is set. No pruning in v1.
- Options: separate versions table, cap at 5 versions (DESIGN-SYSTEM 11.24), cap at 20 (M18-S08).
- Why: uses the schema as built, the unique draft and published indexes enforce one of each, and rows are tiny (under 16 KB each by CHECK).
- Reversible: yes.

## D-034 Theme and settings writes require the admin role (lane H)
- Decision: all theme and site settings writes need `role = 'admin'` (editors and viewers get 403). The "Super admin only" flags and limits (S64) use the same check until the roles lane adds a super admin tier. Audit entries are written inside the same transaction as the change.
- Reversible: yes, one function per service.

## D-035 Analytics collection model (lane I)
- Decision: events are sent as batches to one ingest route. The profile and audience come from the session, never the body. Viewer counts use `viewer_hash`, an HMAC of the Lagos day and profile id, so the id rotates daily and cannot link days. Kids profiles store no profile id and no hash. Device, connection, country, errors, empty searches, startup and web vitals are daily counters in `analytics_counters` (migration 0008), bucketed histograms for timings. Daily views, watch time and completions roll up into `video_daily_stats` and the new `site_daily_stats`. Retention curves are built from raw `view_events` (24 month window).
- Options: store every event raw and aggregate later, or a third party analytics tool.
- Why: no third party scripts, no cross day tracking (M19-S07), small tables for fast dashboards. The hashing key is derived from `MEDIA_URL_SECRET` by HMAC with a fixed label, so no new variable is needed.
- Limits: "unique viewers" for a range is the sum of daily uniques, because the id rotates. Watch time is client reported and bounded to 6 hours per play, so it is a usage measure, not a billing grade number.
- Reversible: yes.

## D-036 Analytics fails open (lane I)
- Decision: ingest returns 202 even when storage fails, drops bots, admin previews and unknown videos silently, and answers 429 with `Retry-After` only for rate limits. The browser client never throws and never retries across page loads. The rate limiter is the `@ad/security` one (structural interface), so the limits are enforced by the same Postgres buckets (`rate_limit_buckets`).
- Why: M19-S01 says an event write failure must never affect playback.
- Reversible: yes.

## D-037 Upload sessions: resume, replace and cleanup (lane D)
- Decision: a second `create` with the same fingerprint while a session is open returns that session (resume). Replace creates a session on the existing video and swaps the source only after the new upload completes, removing the old original, renditions, key and media prefix, and rotating `mediaPrefix`. Replace is refused while the video is published or scheduled. Sessions idle for 48 hours (`expires_at` moves on every part request) are aborted by `uploads.cleanup`, and a draft video that never got a source is deleted with its session. Generic or empty browser MIME types are accepted for mkv and mov because browsers send nothing for them, the extension decides and the magic bytes are checked in `video.probe`.
- Options: refuse a second session, keep the old rendition files until the next publish, trust the declared MIME.
- Why: matches M13-S05, S08, S11 and ARCHITECTURE section 7. A new `mediaPrefix` means the CDN never serves stale segments (ARCHITECTURE section 12).
- Reversible: yes.

## D-039 Service worker caches static files only (lane I)
- Decision: the worker caches hashed build files, icons, fonts and public posters (when CORS readable), plus a precached offline page. Page HTML, API responses, admin pages, video playlists, segments, keys and captions are never stored, and a request with Range or Authorization is never touched. A failed navigation shows `/offline`. Updates wait until nothing is playing, apply on navigation or when the page is hidden, then show an "Updated" notice. `PWA_ENABLED=false` serves a worker that clears every cache and unregisters. The worker text is served by `/sw.js` with the build id (`APP_VERSION`) baked in.
- Options: also cache page HTML for "recently opened" (S34), or use a build tool such as Workbox.
- Why: pages are personal and phones are shared, so stale or leaked HTML is worse than an offline screen. A short worker with a tested policy is easier to audit than generated code. The "Recently opened" list in S34 can be added later from a local list of titles without caching HTML.
- Reversible: yes.

## D-040 Install prompt and Data saver defaults (lane I)
- Decision: install banner after two visits at least 3 days apart, hidden 30 days after Not now, never after two dismissals or an install. iPhone Safari gets the three step sheet, other iPhone browsers the open in Safari notice. Data saver defaults on for Save-Data or a slow effective type, the viewer's saved choice always wins, and the choice is stored per profile in local storage with an `onChange` hook for the profile service to persist it. Quality cap 360p, posters 320 px.
- Why: matches M25-S01 and M25-S03. Server side persistence waits for the profile service.
- Reversible: yes.

## D-041 Observability without an SDK (lane I)
- Decision: request ids come from `x-request-id` when well formed, else `req_` plus random base32. `withRequest` wraps route handlers: id in and out, one structured log line per request without the query string, and a 500 body that carries only a generic message and the reference id. Error tracking is a small fetch based Sentry envelope sender that does nothing unless `SENTRY_DSN` is set, sends release, route and request id only, masks emails, groups repeats for a minute and ignores outages. `/api/ready` checks database, storage and queue in parallel with a 2 second timeout and returns 200 or 503 with pass or fail per check and no error text. Liveness stays `/api/health`.
- Options: the official Sentry SDK, OpenTelemetry.
- Why: the SDK adds bundle size and ships breadcrumbs and user data by default, which conflicts with M24-S03 "no personal data" and the 300 KB budget. The sender is about 80 lines and tested.
- Reversible: yes. Swap `createErrorReporter` for the SDK behind the same interface.
## D-042 Player engine: Video.js v10 media layer with hls.js (lane G)
- Decision: Video.js v10 is stable (video.js 10.5.0 is the npm latest tag, @videojs/react and @videojs/hlsjs-video 10.5.0 published Nov 2026). The player consumes its pinned hls.js build (`Hls` from @videojs/hlsjs-video, hls.js 1.7.4) behind our own PlayerEngine interface, with custom controls matching mockups S21 to S26. Native HLS is used only when MSE is unavailable (older iOS), with the token as ?pt=.
- Options: Video.js v10 React skin, Vidstack, Plyr.
- Why: the stock v10 skin cannot match the mockups without rebuilding it, and our token, key loader and recovery rules need direct engine control. The engine interface lets a v10 skin or Vidstack replace it later.
- Reversible: yes.

## D-043 Player timings and defaults (lane G)
- Decision: progress every 15 s (ARCHITECTURE; stories say 10 s), up next countdown 5 s (story; mockup shows 8), configurable. Countdown shows the number only under reduced motion and still autoplays, following S25. Data saver cap is 360p, configurable. Start rendition is 360p on Save-Data or 2g/3g, else 480p. Player preferences are stored per profile in localStorage until M03-S09 exists.
- Reversible: yes.

## D-044 Key loader keeps the hls.js context intact (lane G)
- Decision: the ad-key:// loader passes a copy of the context to hls.js and returns the original to callbacks, because hls.js looks keys up by context.url. Found by the Playwright smoke.

## D-051 Fonts through next/font, not fontBaseUrl (lane E)
- Decision: the root layout loads Inter, Poppins, Nunito, Lora and Atkinson through `next/font/local` (latin and latin-ext woff2 in `apps/web/src/fonts`) and sets `--font-sans` inline on html. Lora is display only; body stays Inter, matching `buildThemeCss`. `getThemeInjection` is called without `fontBaseUrl`.
- Options: serve `/fonts/{key}.woff2` as lane H expects.
- Why: next/font gives hashed immutable URLs, preload and size-adjust fallbacks with no extra route.
- Reversible: yes.

## D-052 Fixture data layer behind swappable interfaces (lane E)
- Decision: all viewer pages read through `lib/data` accessors (`getCatalog`, `getLibrary`, `getProfiles`, `getAuth`, `getAccount`, `getSite`) with in-memory fixtures. A fixture session in `lib/session.ts` uses cookies `ad_fixture` and `ad_profile`; default is signed in as the first profile. `setDataForTests` swaps implementations.
- Why: lanes B and C were not on main when the pages were built. Replacing a fixture with the real service is a one file change per accessor.
- Reversible: yes.

## D-053 LinkProvider for ui links (lane E)
- Decision: `@ad/ui` renders plain anchors by default. `LinkProvider` in the app supplies `next/link`.
- Why: keeps the package free of a Next dependency and testable in plain jsdom.
- Reversible: yes.

## D-054 Password strength uses zxcvbn, loaded on demand (lane E)
- Decision: `PasswordField` lazy loads `zxcvbn` on first typing and shows text plus a meter. Minimum length 10 stays the hard rule.
- Why: keeps the initial bundle small; strength is advice, not a gate.
- Reversible: yes.

## D-055 Web vitest uses oxc JSX (lane E)
- Decision: `apps/web/vitest.config.ts` sets `oxc: { jsx: { runtime: 'automatic' } }`; component tests opt into jsdom per file with a docblock.
- Why: the esbuild option no longer parses tsx under Vitest 5.
- Reversible: yes.

## D-045 Captions: audio bytes to Whisper, status mapping and public captions (lane D)
- Decision: the worker extracts mono 16 kHz WAV and posts the bytes to the Whisper service, so the service needs no storage credentials and no network path to storage. Drafts live in the originals bucket under `captions-draft/`, approved files are copied to the media bucket under `cap/{prefix}/` and served unsigned by the edge (captions are not secret). Review status `in_review` maps to the database value `needs_review`.
- Options: send a presigned url to Whisper, or serve captions through the app.
- Why: bytes keep the Whisper container isolated. Captions carry no secret and need caching.
- Reversible: yes.

## D-046 Thumbnails and probe re-download (lane D)
- Decision: thumbnail candidates are stored as webp assets with raw key `candidates/{videoId}/{n}`, the poster defaults to the middle candidate. Probe, encode and thumbnails each download the source again instead of sharing scratch space, so any step can be retried alone on a fresh worker.
- Why: retries and crash recovery stay simple, the cost is extra download time on the local network.
- Reversible: yes.

## D-047 Playback delivery: edge serves cap and img unsigned, segments signed (lane D)
- Decision: `apps/edge` verifies HMAC only for `v/` keys, serves `cap/` and `img/` without a signature, drops `exp` and `sig` from the cache key, and allows CORS only for the app origin. Segment urls last 6 hours by default (`segmentTtlSeconds`) because a VOD playlist is fetched once. Missing, unpublished, deleted or kids-hidden videos return 404 from the session route, and the key route re-checks publish state and kids rules on every request.
- Options: short segment urls with periodic playlist refresh.
- Why: refresh adds player complexity and failure modes for no gain, the key route stays the real gate.
- Reversible: yes.

## D-048 Purge of deleted videos (lane D)
- Decision: soft deleted videos are purged after 30 days (`graceDays`) by the nightly `videos.purge_deleted` cron, which queues one `video.purge` job per video. Purge deletes media, originals, templates, draft captions and the script, then hard deletes the row, and refuses to touch a video that is not soft deleted. Poster and hero assets are left to the image lane.
- Why: gives staff a recovery window and keeps the destructive step small, repeatable and guarded.
- Reversible: the grace period is configurable, deleted files are not recoverable.

## D-049 Viewer API wiring (lane C)
- Decision: viewer services take a `ViewerContext` (db, media origin, name cipher, password check, optional rate limit seam, clock, rules) and an `Actor`. Every read and write runs in `withAccount` and filters by `account_id` explicitly, because the admin role has a read policy on profiles. The active profile is a signed cookie (HMAC keyed from `PLAYBACK_TOKEN_SECRET` with its own label, bound to the account id). It only feeds the kids gate on management routes. Routes check Origin on writes, answer `Cache-Control: private, no-store`, and map service errors to `{ error: { code, message, fields? } }` with `Retry-After` on 429. Rate limits use named buckets (progress 30/min, search 60/min, PIN 5 per 15 min, kids exit 5 per 15 min).
- Options: trust a `profileId` header, or keep the active profile in the session row.
- Why: every service rechecks ownership, so a forged cookie gains nothing. A cookie needs no change to lane B's session table.
- Reversible: yes.

## D-050 Catalog rules (lane C)
- Decision: kids mode uses the `kids_safe` flag from DATA-MODEL, not the suitability labels in the stories. The duration filter and the "shortest" sort apply to standalone videos only, series are left out. My List holds 500 titles (configurable, DATA-MODEL says 200). Search uses Postgres full text (weighted title and description, `simple` config) plus trigram and prefix matching through an IMMUTABLE `ad_unaccent` wrapper, with an offset cursor. Home injects Continue Watching and My List first unless the editor placed them. "Remove from row" deletes the progress record, which also clears the watched tick. A scheduled title that fails the publish checklist at release time goes back to draft and is audited. Republishing keeps the first publish date. Approved captions are required to publish unless an admin gives a reason.
- Why: matches the schema we have, keeps queries index friendly, and fails closed.
- Reversible: yes.

## D-058 Roles and staff model (lane B)
- Decision: three roles only (viewer, editor, admin). Super admin is the admin role and there is no analyst role, in line with D-025. Staff sessions last 30 minutes idle and 8 hours absolute. A staff account that signs in at the viewer endpoint gets a viewer session with no second factor, and admin pages require a session that passed it. Role changes go through the SECURITY DEFINER function `staff_set_role`, which rechecks the actor in SQL and refuses self change and removal of the last admin.
- Options: add a separate super admin role, or let the app update roles directly under row level security.
- Why: matches the permission matrix already in the admin UI, and keeps role escalation in one audited place.
- Reversible: yes.

## D-059 Account lifecycle and deletion (lane B)
- Decision: an unverified account is an account with `email_verified_at` null, with no extra status. Account deletion is immediate: personal data is removed in one transaction and the per account key is destroyed, which makes every remaining ciphertext unreadable. If key destruction fails, a row in `account_deletions` is retried by `destroyPendingKeys`. The 14 day grace period in the stories is deferred.
- Options: a pending_deletion state with a grace period and a restore link.
- Why: SECURITY.md section 10 asks for crypto-shredding, and a grace period needs a scheduled job and a restore flow that no story depends on.
- Reversible: yes, by adding the state later.

## D-060 Token lifetimes and codes (lane B)
- Decision: password reset links last 30 minutes (SECURITY.md), not the 1 hour in the stories. Email verification codes last 15 minutes with 5 attempts, verification links 24 hours, email change links 24 hours, admin invites 72 hours. All are values in `AuthConfig`. Recovery codes look like `xxxxx-xxxxx` and are stored as HMACs. The invite mail links to `/admin/invite/<token>`.
- Options: follow the story values.
- Why: the security document is the stricter source. All values are configurable.
- Reversible: yes.

## D-061 Own primitives instead of heavy libraries (lane B)
- Decision: password strength uses a small estimator with a common password list and a rule checklist, not zxcvbn. TOTP (RFC 6238, plus or minus one step, replay guard) is written on node:crypto. QR codes use the `qrcode` package. Passwords use Argon2id through @node-rs/argon2 (m=19456, t=2, p=1) behind a concurrency cap of 2, with a dummy verify for unknown accounts.
- Options: zxcvbn, otplib.
- Why: fewer dependencies in the auth path and a client safe policy module (`@ad/auth/policy`).
- Reversible: yes.

## D-062 Rate limits and lockouts (lane B)
- Decision: a Postgres token bucket (`FOR UPDATE` in a transaction) plus an `auth_lockouts` table keyed by email hash, so unknown addresses lock exactly like real ones. Limiter or lockout store failure fails closed on auth routes. There is no global API limit in the proxy because Cloudflare handles that. The client address is read only from CF-Connecting-IP when `TRUSTED_PROXY_MODE=cloudflare`, and only the truncated address is stored.
- Options: Redis, an in memory limiter.
- Why: no new infrastructure, and it survives restarts and multiple web processes.
- Reversible: yes.

## D-063 Auth data placement and config (lane B)
- Decision: verification codes live in `verification_codes` (migration 0006), the role function in migration 0011. `AuditWriter` lives in `@ad/security`. New web env variables: `KEYS_DATABASE_URL_SHRED` (optional, only processes that delete accounts need it), `CSP_REPORT_ONLY` (default false) and `SUPPORT_EMAIL` (defaults to the From address). Real auth runs when DATABASE_URL, FIELD_KEK and EMAIL_HASH_PEPPER exist, otherwise the UI falls back to fixtures. `AUTH_FIXTURES=on|off` overrides this outside production, and production always runs real auth.
- Options: a hard switch per environment.
- Why: lets UI work continue without a database while production can never serve fixtures.
- Reversible: yes.

## D-064 Sign up consent and other viewer UI limits (lane B)
- Decision: the sign up screen states that creating an account accepts the terms and confirms an adult or guardian, so the gateway records both consents as given. "Sign out other devices" in the account area does not ask for the password (the separate sign out everywhere method does). Playback settings, the data export request and profiles stay on the fixture repositories until the viewer data integration.
- Options: add checkboxes to the sign up form.
- Why: keeps the existing screens unchanged. A checkbox is a small follow up if the client wants explicit consent.
- Reversible: yes.

## D-065 Admin data goes through typed services with fixture implementations (lane F)
- Decision: every admin screen reads and writes through an interface in `apps/web/src/lib/data/admin/services.ts`. Each call takes the actor and re checks `can()`. Fixture implementations run on an in memory store. Audit, analytics and player quality read the real packages (`@ad/audit`, `@ad/analytics`) when `ADMIN_DATA=real`, with the same result shapes.
- Options: wait for every lane, or call packages directly from pages.
- Why: lets the screens be built and tested without a database and swaps data sources without touching components.
- Reversible: yes.

## D-066 Production never serves admin fixture data (lane F)
- Decision: `getStore()` throws when `NODE_ENV=production` unless `ADMIN_FIXTURES=on` is set on purpose. Screens that are not yet backed by a real service fail with the admin error page instead of showing invented people, videos or numbers.
- Options: show fixtures with a banner, or hide the screens.
- Why: fake data that looks real is the worst failure for an admin tool, and a loud failure is easy to notice and fix.
- Reversible: yes. Each service that gets a real implementation stops using the store.

## D-067 Audit log scope for admins (lane F)
- Decision: the audit screen asks `@ad/audit` for scope `all`. D-025 and D-058 make the admin role the super admin, so security namespaces are visible to admins. Editors cannot open the screen.
- Options: scope `content` for admins.
- Why: there is no separate lower admin role to hide security events from.
- Reversible: yes, one argument in `audit-real.ts`.

## D-068 Server rendered filters for list screens (lane F)
- Decision: users, audit log and analytics filters are plain GET forms and the audit detail panel is chosen with `?entry=`. Lists page with a keyset cursor.
- Options: client state with fetch.
- Why: works without scripts on slow phones, links are shareable, and there is less client code.
- Reversible: yes.

## D-069 Staff mutations stay on fixtures until a reauth step exists (lane F)
- Decision: roles, invites, staff password change and recovery code regeneration run on fixtures. The real `StaffService` methods need a password confirmed in the last 10 minutes and, for password and codes, a current authenticator code. The screens have no reauth dialog yet.
- Options: wire them now and let every action fail with a reauth error.
- Why: a half wired mutation is worse than a clear gap. Under D-066 these screens fail in production until wired.
- Reversible: yes. Add a reauth dialog calling `StaffService.reauthenticate`, then a `staff-real.ts` adapter.

## D-070 Admin catalog writes live in @ad/catalog/admin and the home page config in settings (lane K3)
- Decision: staff videos, categories, series, trash and home curation are functions in `packages/catalog/src/admin`, each taking `(ctx, actor, ...)` and running inside `withAccount` with an audit entry in the same transaction. Home curation keeps its draft, published and previous configs as JSON in `settings` (`home.draft`, `home.published`, `home.previous`, `home.published_at`). Publishing writes the same config into `rows` and `row_items` in one transaction, so the viewer API reads only `rows`. A "series" row is snapshotted to the series episodes at publish time (a curated row), and row ids from the editor screen map to stable uuids. Migration 0012 adds `videos.tags`, `suitability`, `caption_override_reason`, `poster_focus` and `accounts.suspended_reason`, `suspended_at`.
- Options: a new `@ad/admin` package, or a draft and published column pair on `rows`.
- Why: the fixture screens already model the whole config as one document, a settings document keeps draft and rollback atomic without a second set of tables, and the catalog package already owns publishing and the visibility rules.
- Reversible: yes. A series row does not follow later episode changes until the next publish.

## D-071 Viewer suspension goes through a SECURITY DEFINER function (lane K3)
- Decision: migration 0013 adds `staff_set_account_status(actor, target, status, reason)`, which re checks in SQL that the caller is an active admin and only ever changes viewers. Same pattern and error codes as `staff_set_role`.
- Options: let the app role update any account row, or widen the accounts RLS policy.
- Why: RLS hides other accounts from the app role on purpose, and a bug in the app layer must not be able to suspend or edit staff.
- Reversible: yes.

## D-072 Real versus fixture viewer data is chosen by one helper (lane K1)
- Decision: `realDataEnabled()` is true in production always. Elsewhere it follows real auth, and `VIEWER_FIXTURES=on` forces fixtures. Real data requires real auth.
- Options: a separate flag per repository, or fixtures by default.
- Why: mixing real data with fixture sessions gives profiles that do not exist, and one switch is hard to misconfigure.
- Reversible: yes.

## D-073 Cards, redirects and tones on the viewer seam (lane K1)
- Decision: cards carry an empty category and publish date. Episode and moved slugs return a redirect path. The five profile tones map to the first five avatar ids. Items are keyed `video:<uuid>` or `series:<uuid>`.
- Options: extend card queries with category and date, or hide those fields in the UI.
- Why: the list queries do not join categories, and the card UI hides empty values.
- Reversible: yes.

## D-074 Playback preferences and export design (lane K1)
- Decision: playback preferences are stored in `profiles.playback_prefs` (migration 0014) next to the existing autoplay and data saver columns. Data export is generated on request behind a 10 minute HMAC link bound to the account.
- Options: a settings row per profile, or an emailed export job.
- Why: one column is additive and cheap, and an on demand export needs no worker or storage.
- Reversible: yes.

## D-075 Account deletion grace period deferred (lane K1)
- Decision: deletion stays immediate per D-059. The 14 day grace period is not built.
- Options: add an account status, a purge job and cancel on sign in now.
- Why: it needs a worker job and a status that touches sign in, and was marked "if feasible".
- Reversible: yes.

## D-076 Admin data is real by default and fixtures are opt in (lane K3)
- Decision: `adminDataMode()` returns real unless `NODE_ENV=test` or `ADMIN_DATA=fixture`. In production fixtures are always refused, and `ADMIN_DATA=fixture` there throws instead of falling back. The old `ADMIN_FIXTURES=on` override from D-066 is removed. Each service is a `delegating(fixture, real)` object that picks per call and imports the real code on first use. The upload screen uses the HTTP transport whenever data is real.
- Options: keep the escape hatch for demos, or make fixtures the default in development.
- Why: a demo escape hatch in production is how invented numbers reach a client, and developers should see the same code path that ships. Fixtures stay for unit tests and UI work.
- Reversible: yes.

## D-077 Admin jobs and storage come from catalog records (lane K3)
- Decision: the System screen lists failed jobs from the `jobs` mirror table (D-029), maps queues to the screen's five kinds, and takes max attempts from the queue definition. Retry queues the same work again and marks the old row cancelled. Discard needs a reason and marks the row cancelled with the reason in the audit entry. Storage is added up from `videos`, `renditions`, `assets` and `captions` rows (and open upload sessions as other), so it is cheap and does not list buckets. The cap is the `limits.storage_cap_bytes` setting, default 200 GB, and "months left" divides the room left by the last 30 days of growth.
- Options: read pg-boss tables directly, or list the buckets.
- Why: the mirror already holds plain language errors for staff, and bucket listing is slow and costs requests. Objects without a catalog row (orphans) are not counted.
- Reversible: yes.

## D-078 Staff names come from a SECURITY DEFINER directory (lane K3)
- Decision: migration 0015 adds `staff_directory(actor, ids)`, returning the sealed email of staff accounts to an active staff caller. The app opens it with the key service and shows the readable part before the at sign as the name, as the signed in header already does. Editors never see addresses.
- Options: store display names in plain text, or show "Staff member".
- Why: names on "uploaded by" matter to editors and accounts hold no plain text name.

## D-079 Video route layout and admin API paths (lane K2)
- Decision: playlists are one dynamic route `/api/play/{id}/{file}` that serves `master.m3u8` and `{height}.m3u8` and answers 404 for any other name. Admin routes live under `/api/admin`: `uploads` (create, describe, parts, complete, abort, the paths lane F's uploader already calls), `videos/{id}/encoding`, `videos/{id}/captions`, `videos/{id}/publish`, `captions/{id}/approve`. Handlers are built in `server/video/api.ts` and route files are one line wrappers.
- Options: a folder per playlist kind, or one route per admin action under `/admin`.
- Why: Next cannot put a dynamic segment inside a file name, and the uploader paths were fixed by ARCHITECTURE section 7. The publish route is needed so the pipeline can be completed through the API until the lane F screens are wired.
- Reversible: yes.

## D-080 Maintenance connection and audit purge grant (lane K2)
- Decision: the worker takes an optional `DATABASE_URL_MAINTENANCE` (role `ad_maintenance`). Without it the view event prune and audit prune jobs are not registered or scheduled, and the worker logs one warning. Migration 0015 grants `INSERT` on `audit_log` to `ad_worker`, because the purge writes one row recording itself and `ad_maintenance` cannot insert. The append only trigger still blocks update, delete and truncate for everyone but `ad_maintenance`.
- Options: let `ad_maintenance` insert, give the worker `DATABASE_URL` for the web role, or skip the purge record.
- Why: keeps `ad_maintenance` delete only, avoids a second app credential in the worker, and keeps the purge on the audit trail.
- Reversible: yes.

## D-081 Fake transcriber and scratch space ratio are configuration (lane K2)
- Decision: `WHISPER_FAKE=true` makes the worker use a scripted transcriber (development and tests only, rejected in production). `WORKER_SCRATCH_MIN_FREE_RATIO` (default 0.15) sets how much of the scratch disk must stay free before a job starts.
- Options: hard code both, or run a fake whisper HTTP server in tests.
- Why: the real run needs captions without the 2 GB model, and a small disk should be tunable without a code change. The default keeps the lane D rule.
- Reversible: yes.

## D-082 Shared key rate bucket without a trusted proxy (lane K2)
- Decision: `clientIp` returns null unless `TRUSTED_PROXY_MODE=cloudflare`, so the per IP key limit (300 per minute) uses one shared bucket named `untrusted` in that case. Production must set the proxy mode.
- Options: read `X-Forwarded-For` (spoofable), or skip the per IP limit.
- Why: the per profile limit still applies, a spoofable address would let one client dodge the limit, and development traffic is far below the shared cap.
- Reversible: yes.

## D-083 Caption review saves revisions and previews with the real player (lane K3)
- Decision: the caption review screen talks to lane D's `CaptionService`. Every autosave pause stores a new revision (earlier unapproved ones become superseded), Approve approves the newest revision and accepts warnings as the screen already says, and Upload and Save are the same call on the English track. Cue ids on screen are positional (`cue_1`, `cue_2`), so "changes since approval" compares by position and id. The playhead is `usePreviewClock`: the `@ad/player` controller on a staff preview session (`POST /api/play/{id}/session` with `{preview:true}`), falling back to the old timer when no session can be minted.
- Options: coalesce autosaves into one working revision, or build a separate preview player.
- Why: the service already owns revision numbers and the approved copy, and the viewer controller already handles tokens, stalls and quality. A revision per pause is noisy but safe, and coalescing needs a change in lane D.
- Reversible: yes. Coalescing is a follow up in `storeRevision`.

## D-085 Staff mutations run on the real StaffService behind a reauth dialog (lane K3)
- Decision: this replaces D-069. Invites, resend, cancel and role changes call `StaffService`. When the service answers `ReauthRequired` the command result carries `reauth: true`, and `useReauth` shows a password dialog, calls `PeopleService.reauthenticate` (which marks the session) and repeats the command once. The admin actor carries the staff `sessionId`. Role changes read the person's current role first and pass it as `expectedRole`. Resend creates a new invite for the same address, which cancels the old one. Viewer suspension, reinstating and sign out everywhere write their audit row with the status change in one transaction.
- Options: a separate reauth page, or asking for the password on every staff mutation.
- Why: a modal keeps the person on the screen and the 10 minute window means one prompt per sitting.
- Reversible: yes.

## D-084 Production refuses to start without a trusted proxy, a shred connection and distinct secrets (lane J1)
- Decision: in production the web env loader rejects `TRUSTED_PROXY_MODE` other than `cloudflare`, a missing `KEYS_DATABASE_URL_SHRED`, and any two of `FIELD_KEK`, `EMAIL_HASH_PEPPER`, `HLS_KEK`, `PLAYBACK_TOKEN_SECRET`, `MEDIA_URL_SECRET` that hold the same value. Logs redact `email` keys and mask addresses inside string values and error text.
- Options: warn only, or fall back to per account limits when the address is unknown.
- Why: without a trusted proxy every per IP limit shares one bucket, so 20 bad sign ins by anyone lock everyone out for 15 minutes. Without the shred connection a deleted account keeps its key. Reused secrets collapse separate trust domains.
- Reversible: yes. If the site is ever served without Cloudflare, add a second proxy mode instead of removing the rule.

## D-086 My account is real, display names are sealed and codes replace passwords (lane K3)
- Decision: staff display names are stored in `accounts.display_name_enc` sealed under the `display_name` key column, and `staff_directory` (migration 0017) returns them so other staff see the chosen name. Without one, the name comes from the email address as before. Changing the password and making new recovery codes take the 6 digit authenticator code (D-069) instead of a password prompt, and the screen shows an "Authenticator code" field for both. A password change rotates the session, so the real service writes the new cookie through `AdminRuntime.setSession`. Resetting another person's two factor is a Reset button on the roles screen that asks for the admin's own code.
- Options: keep the name derived from the address only, or add a new profile table for staff.
- Why: the column already existed unused, sealing keeps it with the other personal fields, and the lane B service already defines which proof each action needs.
- Reversible: yes. Remove the column read to fall back to address names.

## D-087 Turnstile, staff preview page, real 403 and session warning (lane K3)
- Decision: (1) Turnstile is on for viewer sign in, sign up and admin sign in only when both `TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET_KEY` are set, and off otherwise. The server verifies each token with Cloudflare and fails closed (a missing token, a refusal or an unreachable service all answer "check required"). A token works once, so the widget resets after every attempt. (2) "Preview as viewer" opens `/admin/videos/:id/preview` in real mode, a page under `/admin` that plays the real player on a staff preview session. A shared link fails for anyone who is not signed in staff. Fixture mode keeps `/watch/:id`. (3) Admin pages for the wrong role call `forbidden()`, which needs `experimental.authInterrupts` in `next.config.ts`, so the response status is 403. The generic page no longer names the page. (4) A warning dialog appears two minutes before the 30 minute idle limit, counted from the time left the server reports, and "Stay signed in" asks the server, which restarts the idle timer. Moving to another page restarts the countdown, and it never runs past the 8 hour limit.
- Options: fail open when Cloudflare is down, or serve the preview through `/watch/:id` with a signed link.
- Why: failing open lets a bot flood through whenever Cloudflare has an incident, while failing closed only delays a person briefly. A page under `/admin` reuses the staff session check and the preview session route, so there is no second kind of link to leak.
- Reversible: yes. `authInterrupts` is experimental in Next 16, so watch its release notes.
## D-088 The kids lock is stored on the session row (lane J1)
- Decision: `sessions` gains `active_profile_id` and `kids_locked` (migration 0018, additive). Selecting a kids profile locks the session. While locked, the viewer API guard, select, profile management and the playback session accept only the locked profile, and the `ad_profile` cookie is ignored. Exit kids mode with the account password clears the lock. If the locked profile is deleted the session stays locked with no profile until the password is entered (fails closed).
- Options: a PIN on every grown-up profile, or a longer lived signed cookie.
- Why: any cookie or request field is client controlled, so only server state can hold the lock. A fresh sign in needs the account password, so clearing cookies gains nothing.
- Reversible: yes. The columns can stay unused.

## D-089 Security review Lows: what was fixed and what was accepted (lane J4)
- Decision: (1) One per staff budget, `adminGeneral` at 300 per minute, covers admin API routes (in `getActor`), every admin server action (`requireActionActor`) and the audit export. (2) Every unsafe viewer API method needs a same origin Origin or Sec-Fetch-Site. (3) Staff cannot sign in through the viewer form: the right password gets `use_admin_login` and a redirect, a wrong one looks like any wrong password. (4) Any role change ends the target's sessions. (5) The staff SQL functions require `p_actor` to equal the request context account (migration 0019). (6) Accepted without code change: segment urls last 6 hours (L-3), `cap/` and `img/` stay unsigned (L-4), pending upload cap stays 20 (L-5), `verifyCode` keeps its statuses (L-12). SECURITY.md now says 6 hours, 20 and a 15 minute viewer lock (L-13, D-004). (7) CI runs a grep secret scan, new dependency versions must be a day old, and `scripts/check-headers.sh` checks production headers.
- Options: shorten segment urls to 2 hours, sign `cap/` and `img/`, cap uploads at 5, collapse verify statuses, drop the viewer lock for a slow refill.
- Why: each accepted item has a stronger existing control or a real cost to the client (long videos, batch uploads, helpful code errors), and the reasons and residual risks are in `docs/SECURITY-REVIEW.md`. The fixed items closed real gaps with small changes.
- Reversible: yes. All are constants or small guards, and migration 0019 can be replaced by one that drops the context check.

## D-090 One audit writer in @ad/audit with one redaction policy (lane A2)
- Decision: `AuditWriter` moves from `@ad/security` to `@ad/audit` and is a thin best effort wrapper over `writeAudit`, so security events and admin entries share entry validation and `redact`. `redact` now also replaces fields named like a hash, an email or a one time code, on top of the earlier secret names, and masks addresses inside any string. `@ad/auth` and the web auth runtime import the writer from `@ad/audit`; `packages/security/src/audit.ts` is deleted.
- Options: keep both writers, or make the security writer call `redact` but stay in `@ad/security`.
- Why: two writers on one table drifted (one dropped keys, the other masked values) and a new field could leak through one and not the other. `@ad/audit` already depends on `@ad/security` for `truncateIp`, so the writer cannot live in security.
- Reversible: yes.

## D-091 Retention windows come from settings, read at each run (lane A2)
- Decision: new setting `audit.retention_months` (6 to 120, default 24, Super admin, not public, shown in Site settings). The monthly audit prune and the raw view event prune read their window from `settings` on every run through `readSetting` (`@ad/theme/settings`, a subpath that skips the logo and image code), and fall back to the registry default when the row is missing or invalid. The worker role already has SELECT on `settings`.
- Options: keep a compiled default, or pass the window as a job payload.
- Why: M20-S04 asks for a retention setting, and a change should apply without a deploy. The analytics prune had the same gap (`analytics.raw_retention_days` existed but was never read), so the registry default (90 days) now governs raw events instead of the 730 day compiled constant.
- Reversible: yes.

## D-092 Account deletion has a 14 day grace period, superseding D-059 and D-075 (lane M2)
- Decision: requesting deletion (password and typed DELETE) moves the account to the new `pending_deletion` status, ends every session and mails the purge date with a link to `/account/deletion`. Nothing is removed yet. Signing in with the right password opens a session that only sees that cancel screen (all other checks still require `active`, so they fail closed); Cancel deletion makes the account active and removes the `account_deletions` row. `purgeDueDeletions` runs in the web process with the key retry job (`runDeletionJobs`), removes personal data in one transaction, destroys the account key (crypto shredding) and mails "was deleted". The grace length is `AuthConfig.deletionGraceDays` (default 14). Migration 0020 adds the enum value and `account_deletions.purge_after`.
- Options: a signed cancel link in the mail, or a worker job.
- Why: sign in already proves ownership, so no second token type is needed. The web process already holds the shred connection and runs the retry job, and the worker role has no identity grants.
- Reversible: yes. Pending accounts do not show in the admin users list.

## D-093 Image variants: webp plus jpeg, one ladder per purpose, frames go through image.process (lane M3)
- Decision: `image.process` (sharp, in `@ad/video`) crops to 16:9 and writes webp and jpeg at 320 to 1280 px for posters, 640 to 1920 px for hero art and 160 to 480 px for thumbnails, never upscaling, into `img/{assetId}/{width}-{hash}.{ext}`. Each variant in `assets.variants` gains an optional `format`. Rows without it are webp. Viewer cards use a `picture` with a webp source and a jpeg image. Video frames from `video.thumbnails` are stored as sources and sized by `image.process`. Custom posters are checked on the server (JPG or PNG by bytes, 5 MB, at least 1280 by 720) and stored under `uploads/{videoId}/{assetId}`. With no variants a generated gradient poster with the title is shown.
- Options: webp only, avif as well, process in the web process.
- Why: jpeg costs little and covers old Android browsers common in the audience, avif encodes too slowly on the worker, and a queue job keeps uploads fast.
- Reversible: yes. Dropping jpeg is one line in the processor.

## D-094 Client configuration is applied by a tool through the existing services, icons are served from a mounted folder (lane M1)
- Decision: `pnpm launch:apply --config client.json` (package `@ad/launch`) validates a Zod file and applies it through `SettingsService`, `ThemeService` and `LogoUploader`, so validation, the readability gate (D-007), audit rows and cache busting are the same as in the admin screens. It acts as the admin named by `adminOwnerEmail`, which must already exist (`pnpm db:seed:admin`); it never creates passwords. Every step compares with what is stored, so a rerun reports `unchanged`. `--dry-run` writes nothing. Home screen icons are generated from the logo with sharp into `PWA_ICONS_DIR` and served by `/brand-icons/[file]` with the bundled icons as fallback, so rebranding needs no image rebuild. Domain and contact values are written to the env file (`--env-file`). Contrast warnings need `--accept-warnings`, blockers always stop the run before anything changes.
- Options: write icons into `apps/web/public` and rebuild the image; upload icons to R2 and point the manifest at the media origin; make the applier a web route.
- Why: images are built in CI and the VPS never builds, so a rebuild per client change would add a CI round trip to a two hour launch. A mounted folder is the smallest runtime path. A command line tool needs no new attack surface.
- Reversible: yes. The manifest can point back at `/icons/*`.

## D-096 Data export is a background job that stores state, not the file (lane M2)
- Decision: a request needs the account password and is refused with "an earlier export is still valid" while a pending or unexpired ready export exists (one per 24 hours, a failed one can be retried at once). `data_exports` (migration 0021) holds status, attempts, size and expiry only. The job runs in the web process (kicked by the request and retried every 2 minutes, up to 3 builds), builds the file to check and size it, then mails a link that works 24 hours. Download rebuilds the file from live data behind the signed token and the session. A signed out visitor of the mailed link is sent to sign in and back. Failure after 3 builds mails "We could not build your export".
- Options: store the JSON in R2 with an expiry, or run the job in the worker.
- Why: storing the file puts personal data at rest outside the account key. The worker role has no identity grants, and the web process already holds the viewer data and keys.
- Reversible: yes.

## D-097 Home and card details from the viewer stories audit (lane a1)
- Decision: (1) The card hover overlay uses `--hover-intent-delay` (500 ms, DESIGN-SYSTEM section 11.5) instead of the 400 ms in M05-S03. (2) The "Add your first video" link on an empty Home (M05-S07 AC2) is not built: staff never hold a viewer session (L-6, `role.test.ts`), so the viewer Home cannot know it is an admin. The admin area already shows the empty catalog state. (3) The Home hero rotates every 8 seconds except under Data saver or reduced motion.
- Options: change the token to 400 ms; let staff sessions open the viewer site.
- Why: the design system doc wins over a story number, and mixing staff and viewer sessions was rejected in L-6.
- Reversible: yes, a token value and one prop.

## D-098 Seek preview sprites: one frame per 5 seconds, public like captions, off with Data saver (lane M3)
- Decision: the `video.thumbnails` job also cuts one frame every 5 seconds (wider for videos over about 20 minutes, at most 10 sheets), packs them 5 by 5 at 160 px wide into jpeg sheets and writes a WebVTT map with `#xywh` cues. Files live under `cap/{mediaPrefix}/sprites/` so they are public, immutable and removed by the existing purge. `videos.sprite_key` (migration 0022) points at the map. The playback session returns `sprite` and the watch data returns `spriteUrl`. The player fetches the map on the first pointer move over the seek bar, never with Data saver on, and failure is silent.
- Options: a separate `video.sprites` queue, signed sprite urls, hover preview clips.
- Why: reusing the thumbnails job and its downloaded source avoids a second download, sprites are 160 px stills so they leak no more than the poster does, and clips would break the low data rules.
- Reversible: yes. Clear `sprite_key` and the player shows only the time tip.

## D-099 Invite only sign up uses hashed codes and the sign up flag (lane A2)
- Decision: `features.signups_open` set to false means invite only (not closed). Sign up then needs a code from `signup_invites` (migration 0023). Codes are 10 characters from a 32 letter alphabet without look alikes, stored only as a hash with the last two characters as a hint, and shown once when created. A use is counted by one conditional update inside the sign up transaction, so a failed sign up does not burn a code and parallel sign ups cannot pass the limit. A missing, wrong, used up, expired or revoked code gives one message, and the code is checked before the existing account lookup so it cannot be used to probe addresses. Admins manage codes in Site settings, Invite codes. The auth service reads the flag at each sign up through `signUpPolicy`, and viewer site content (name, tagline, support email, sign up mode, maintenance) now follows settings with real data.
- Options: store codes in clear so admins can re-read them, a separate invite only flag, or close sign up completely.
- Why: M29-S02 defines the flag as open or invite only, a stolen database should not hand out working codes, and a lost code is cheaply replaced by creating another.
- Reversible: yes.
