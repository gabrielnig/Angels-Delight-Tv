# Decisions Log

Format: decision, options considered, why, reversible or not. Newest first. Decisions that need the owner are decided here with the recommended option, then flagged for confirmation.

## Duplicate id register

Four ids were used twice by parallel lanes. They are never renumbered because lane notes, code comments and PRs cite them. Cite as `D-108 (M2)` when the id is ambiguous. The next free number is always the highest heading plus one, taken on origin/main at merge time. `scripts/decisions-ids.test.ts` fails on any new duplicate.

| Id | Lane | Heading |
|---|---|---|
| D-108 | M2 | Player preferences live on the profile, volume and mute stay on the device |
| D-108 | M3 | Theme presets are colour sets in the theme package, picking one fills colours only |
| D-109 | M2 | Site pages come from the editor table, seeded with marked placeholders |
| D-109 | M3 | Emails read the name, logo and theme colours from settings on every send |
| D-123 | M2 | Catalog reads are cached for 60 seconds in memory and revalidated with ETag |
| D-123 | a3 | Progress and key rate limits stay as built, with the reasons on record |
| D-124 | M2 | Old addresses redirect permanently, and Remove from row can be undone from the database |
| D-124 | a3 | Worker heartbeat in a table, read by a monitor endpoint |

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

## D-100 Profile PIN entry: the server counts the tries, the account password overrides (lane M2)
- Decision: selecting a PIN profile needs the four digit PIN or the account password, checked in `selectProfile`, so the active profile cookie and session row are only ever set after proof. The PIN is limited per profile (5 tries per 15 minutes, `profile_pin` bucket) and the password override spends the shared `kids_exit` budget. The PIN dialog uses the numeric one time code slots and shows the lock time the server returns. After leaving Kids mode with the password, the first grown-up profile without a PIN opens, and if every grown-up profile has a PIN the picker shows and asks. Setting, changing or removing a PIN is on Edit profile and needs the account password.
- Options: a device scoped 5 minute lock as in M03-S12 AC2, or opening the PIN profile directly after the kids password.
- Why: a device lock lives on the client and a forged request skips it, so the server limit is the real one (the story's 5 tries stay, the window is 15 minutes). Skipping the PIN after a password would let anyone who learns the account password bypass the profile separation the PIN exists for, and the picker already offers the password path.
- Reversible: yes. The window is a constant in `@ad/viewer` context.

## D-101 Bulk content import runs through the upload service, dedupes by checksum and applies metadata before the bytes move (lane M1)
- Decision: `pnpm content:import --dir videos/ --manifest videos.csv --admin-email <owner>` validates every manifest row first (CSV or JSON, all problems reported with line numbers, nothing imported while any exist), then for each file calls `UploadService.create`, uploads the parts and calls `complete`, with no HTTP request to the web app. Parts go straight to the presigned storage url (R2) or, with the local driver, into the local folder. The SHA-256 of the file is the idempotency key: the upload fingerprint is derived from it (so an interrupted upload resumes and finished parts are not sent again) and `videos.original_sha256` is written right after the session is created, before any bytes move. A file whose content already belongs to a video with a stored original is skipped, even when renamed. Metadata (title, description, categories, series, season, episode, language, age rating, script) is applied before the upload so a crash never leaves an anonymous video, and it goes through the catalog commands the admin screens use. The `age_rating` column maps to `suitability` (everyone, kids, older), because the schema has no separate age rating. A script is stored at `scripts/{videoId}.txt` and the probe step now queues captions in `align` mode when one exists. Posters go through `createPosterUpload` and the `image.process` job, and are attached on this or any later run once ready (`--wait-posters`).
- Options: call the admin HTTP API with a token; skip by file name; import metadata after the upload; attach posters synchronously.
- Why: the services already hold the validation, quota, audit and queue rules, so the tool cannot bypass them. A checksum survives renames and moves, a name does not. Writing the checksum and metadata first makes every crash point resumable by simply running the same command again.
- Reversible: yes. The tool is additive. The align choice in the probe step is one conditional.
## D-102 Failed encode cleanup removes partial output only, and Replace file reuses the upload API (lane M3)
- Decision: `/admin/encoding/failed` lists failed videos with the plain reason, attempts, whether the original is still stored and the partial output left behind (`v/{prefix}/`, `templates/{id}/` and the sprite files). Clean up deletes those files and the rendition rows, never the original, captions or the failure record, so Retry starts fresh. Editors can retry and clean up. The technical detail is returned to admins only. Replace file opens the upload screen with `?replace={videoId}`, which sends `replaceVideoId` to the existing upload API (one file, the old source and prefix are handled by the upload service).
- Options: clean up automatically after the last retry, delete the original of a failed video, a separate cleanup queue.
- Why: automatic deletion would remove evidence while the admin is still reading the reason, and deleting the original makes Retry impossible. A direct service call is enough because cleanup is quick and safe to repeat.
- Reversible: yes. Nothing here changes existing data formats.

## D-103 The analytics export is one row per title per day (lane A2)
- Decision: `Export CSV` returns `day, video_id, title, archived, views, watch_seconds, completions` for every title with views in the range, from rolled up days plus live rows for today (`titleDaily` in `@ad/analytics`). It replaces the earlier file that held the site totals and only the top 10 titles. Watch time is exact seconds (it was rounded to minutes, which showed 0 for short plays). Titles deleted after being watched stay in with `archived` set to yes. The route spends the per staff admin budget like the audit export. Formula characters in titles are neutralised by the shared `csvCell`.
- Options: keep totals and top titles, or add the per title rows as a second block in the same file.
- Why: M19-S05 asks for daily views and watch time per title. A single table loads straight into a spreadsheet pivot; a second block does not.

## D-104 Staff password checks count toward the admin lockout, and a reset lifts it (lane A2)
- Decision: a wrong password at the confirmation prompt or when changing the password on My account counts toward the admin lockout key (3 failures, 30 minutes, Super admins mailed), the same key admin sign in uses, not the viewer key. A completed password reset clears the admin lockout as well as the viewer one, and sign in still asks for the second factor afterwards.
- Options: keep counting staff reauth failures against the viewer key, or add a third key for My account.
- Why: M12-S09 says a wrong code or password counts toward the admin lockout. With the viewer key a stolen staff session could try 5 passwords per 15 minutes without ever tripping the stricter admin lock, and a locked admin who reset their password stayed locked for 30 minutes.
- Reversible: yes.

## D-108 Player preferences live on the profile, volume and mute stay on the device (lane M2)
- Decision: speed, captions on or off, caption language, caption size, data saver and autoplay are saved per profile on the server (`profiles.autoplay_next`, `data_saver` and `playback_prefs`, which gains `captionLanguage`). The player saves changes through `savePlayerPrefsAction` and starts from the server values. Volume and mute stay in this browser because they describe the device. Existing browser values move once: `migrateDevicePlayback` applies the listed fields the first time it is called for a profile and marks the profile (`deviceMigrated`), so a second device cannot overwrite later changes; the browser copy is then cleared. The player waits for that call before it starts, and starts with the server values if it fails. A profile with Data saver on applies it on every device, while the browser Save-Data hint still turns it on by default.
- Options: keep localStorage as a cache that wins over the server, or move volume to the server too.
- Why: a cache that wins means a change on one device never reaches another, which is the point of the story. Volume differs by speaker, so it should not follow the person.
- Reversible: yes. The marker is one JSON key.
## D-106 Script alignment: word level sequence alignment, flags by cue start time, edit clears the flag (lane M3)
- Decision: `alignScript` aligns script words to faster-whisper words with a global sequence alignment (exact match 3, close spelling 1, mismatch or gap negative), so repeats, fillers and missed words stay in order. Script wording is kept and timing comes from the audio. Unheard words are spread between their heard neighbours, and anything unheard, guessed or recognised with probability under 0.45 is flagged. Flags are stored on the revision as cue start times (`captions.low_confidence_cues`, migration 0024), never in the public VTT. A flag stays only while the cue keeps the same start, end and words, so editing a cue counts as reviewing it. A script that shares fewer than 40 percent of its words with the audio fails as "The script does not match the audio", and Try again then recognises speech without the script. Scripts are stored privately at `scripts/{videoId}.txt` (200 KB limit) and saving one queues alignment.
- Options: stable-ts forced alignment in the whisper service, flags by cue index, a separate review state for flagged cues.
- Why: the algorithm needs no new model or service and is testable on fixtures, start times survive splits and merges better than indexes, and the real model can still be added behind the same function.
- Reversible: yes. Replace `alignScript` behind the same signature.

## D-105 A Home series row follows its series instead of copying episodes (lane A2)
- Decision: `rows.series_id` (migration 0025) marks a curated row that shows the episodes of one series. Publishing writes only the series id, and the viewer side reads the episodes in season and episode order each time, so adding, removing, reordering, unpublishing or deleting an episode shows on Home without publishing the layout again. Episode cards are built by the card query with episodes allowed, because episodes are not standalone titles (the old copied rows resolved to no cards at all). A deleted series leaves an empty row. Rows published before this change stay as copies until the layout is published once more.
- Options: refresh the copied row items whenever an episode changes, or point the row at the series card.
- Why: refreshing needs a hook in every place an episode can change and still goes stale if one is missed; reading at view time cannot drift. A single series card would not be a row of lessons.
- Reversible: yes.
## D-107 Placeholder brand kit generated from one SVG source with sharp (lane M3)
- Decision: `packages/launch/src/brand/kit.ts` holds one icon SVG and one wordmark SVG and builds the favicon, home screen icons, Open Graph image and email header from them (`pnpm brand:generate`, output in `apps/web/public/icons`). Files are named placeholder, the site name in the wordmark is a parameter, and colours default to the old placeholder blue and yellow but can be passed in. The client's logo replaces the home screen icons through the admin logo upload and `launch:apply`, and `PWA_ICONS_DIR` still wins over the bundled files. The favicon and Open Graph image are served through `/brand-icons/` so they can be replaced the same way.
- Options: a Node only PNG writer as before, a design file checked in, a separate brand package.
- Why: sharp is already a dependency, SVG renders crisply at every size, and one source keeps every asset consistent. The old zlib script is removed.
- Reversible: yes. Regenerate or replace the files.

## D-109 Site pages come from the editor table, seeded with marked placeholders (lane M2)
- Decision: terms, privacy, about and help are the pages the admin editor publishes (`settings` rows `pages.<slug>`). Migration 0026 seeds each with one published version of `[Add your ... here before launch]`, which the page shows under a Draft banner and the launch checklist reports as placeholder text. If a row is missing, the same placeholder text from `@ad/theme` stands in, never fixture text. Footer links, the sign in value lines and the common help questions are product defaults in `lib/site/defaults.ts`, shown under the editable help text. The fixture site is used only with the dev flags.
- Options: seed through a CLI step, or keep the fixture text as the fallback.
- Why: a migration runs on every deploy without a manual step, and is idempotent (`ON CONFLICT DO NOTHING`), so launch needs only the client's text.
## D-108 Theme presets are colour sets in the theme package, picking one fills colours only (lane M3)
- Decision: `THEME_PRESETS` in `packages/theme/src/presets.ts` holds six ready themes (default, sky blue, turquoise, lemon green, sunny yellow, lavender). A test requires each to pass the contrast gate with no blockers and no warnings. The editor lists them as radio cards above the colour fields. Picking one replaces the seven colours and leaves font, text size, corners and density alone, and the admin can still edit and must still publish. A theme whose colours match none of them shows "Custom colours".
- Options: store a preset key in settings, let presets also set the font, seed presets into the database.
- Why: the theme model has no preset field and a stored key would drift from the colours once edited. Keeping fonts separate matches how admins choose them.
- Reversible: yes.

## D-110 The admin video list pages in the database with a keyset cursor (lane A2)
- Decision: `listAdminVideosPage` filters, sorts and pages in SQL. The cursor names the last row seen (sort key and id), so it works past 5000 videos and does not shift when videos change. The status badge is computed in SQL and must stay in step with `adminStatusOf`. Fixtures keep the number cursor.
- Options: raise the 5000 cap, or offset paging in the database, or keyset paging.
- Why: a cap hides videos silently, and offset paging slows down and skips rows on deep pages. Keyset costs the same on every page.
- Reversible: yes.
## D-109 Emails read the name, logo and theme colours from settings on every send (lane M3)
- Decision: `Mailer` takes an optional `brand()` lookup that runs for each email. The web app supplies `emailBrandFrom`, which reads `platform.name`, the published theme colours and the published logo, so a theme published in /admin/theme shows in the next email with no deploy. The logo is the 400 px variant on the media origin, shown with the site name as alt text, and the name is shown as text when there is no logo. Colours are checked as six digit hex before they go into inline styles, and a failed lookup falls back to the configured name and the default colours. Email clients ignore CSS variables, so values are written inline.
- Options: cache the brand for a few minutes, render emails in the worker, bake the brand in at build time.
- Why: emails are rare and one small read per send is cheap, a cache would delay the change admins just published, and build time branding contradicts "no deploy".
- Reversible: yes.
- Gap: the logo variants are WebP. Outlook desktop does not show WebP, so it shows the alt text name there.

## D-111 Caption autosaves share one working revision (lane A2, refines D-083)
- Decision: when an editor saves and the newest revision is their own manual save, still in review and under 10 minutes old, the save overwrites it in place instead of adding a revision. A different editor, a revision past the window, an approved or rejected or AI revision, an upload, and Save and keep approved all add a new revision as before.
- Options: a revision per pause (D-083), coalescing for everyone, or coalescing for the same editor within a window.
- Why: a long edit session produced dozens of near identical revisions and buried the real history. The window bounds how much work a single revision can absorb, and other people's work is never overwritten.
- Reversible: yes. Set the window to 0 (`AUTOSAVE_WINDOW_MS`) to return to a revision per save.

## D-112 Staff notices are one row per recipient, written by the worker (lane A2)
- Decision: `admin_notices` (migration 0027) holds one row per active editor or admin, written by `notifyStaff` in `@ad/video` when an encode finishes or fails for good and when captions are ready or fail. Read state is per person. `staff_notification_prefs` stores each admin's email choices (failures on, captions ready and daily summary off). A notice that cannot be stored is logged and never fails the job. Notices older than 90 days are dropped on write.
- Options: one shared notice row with a read list, or one row per recipient.
- Why: per person rows make "mark all read" and the unread badge a plain query, and a shared row would clear the bell for everyone.
- Reversible: yes.
- Not built yet: emailing from these choices (including the hourly summary and the daily summary). The choices are stored and shown, and the in-app bell works.

## D-113 The bell is loaded in the admin layout and fails quietly (lane A2)
- Decision: the shell layout loads the caller's notices with `noticesAdmin.feed`. If that call fails the bell is left out and the admin still renders. Email choices live on `/admin/account` as three switches that save one at a time. Design system review: tokens only, bell button and rows at 44px, Escape closes and returns focus, unread is named for screen readers, empty state says "Nothing new".
- Options: a client side poll for the bell, or load on each navigation.
- Why: navigation already reloads the layout, and polling adds load for a small team. A broken bell must never block staff.

## D-116 Backups use hybrid RSA and AES-GCM encryption instead of age, with private keys kept offline (lane M1)
- Decision: `ad-tool backup` pipes `pg_dump` through AES-256-GCM with a fresh key per file, wraps that key with RSA-OAEP (SHA-256) using the public key in `BACKUP_PUBLIC_KEY_DB_B64` or `BACKUP_PUBLIC_KEY_KEYS_B64`, and uploads `db/ad-<UTC stamp>.dump.enc` and `keys/ad_keys-<UTC stamp>.dump.enc` through the storage adapter. The two private keys are made once by `pnpm secrets:generate` into an offline folder and never reach the server. File layout: `ADBK1`, a 16 bit wrapped key length, the wrapped key, a 12 byte iv, the ciphertext, a 16 byte tag. Retention reads the timestamp in the name: 35 days for the database, 14 for the keys database, 7 for local copies, and the newest 3 are always kept.
- Options: `age` as DEPLOYMENT.md first said; GPG; a symmetric key stored on the server.
- Why: `age` needs a binary in the tools image and a second keypair format, while Node already ships RSA and AES-GCM, so the code is testable with no extra tool. A symmetric key on the server would let a server breach open every backup. Separate keys for the two databases mean a leak of the database key never opens the key material dump.
- Reversible: yes for new backups. Old files stay readable with the old key and the `ADBK1` header names the format.

## D-117 Each database role gets its own password in the production env file (lane M1)
- Decision: the production env file carries `POSTGRES_PASSWORD` plus `DB_PASSWORD_MIGRATOR`, `_APP`, `_WORKER`, `_KEYS_APP`, `_KEYS_SHRED` and `_MAINTENANCE`, all made by `pnpm secrets:generate`. `ops/postgres/01-logins.sh` sets the passwords on first start. compose builds each container's connection strings from its own role only, so the web container never sees the migrator password.
- Options: one shared application password; passwords set by hand after the first start.
- Why: the roles exist to limit damage. One shared password would let a web compromise run migrations or read the keys database. A test in `compose-prod.test.ts` fails if a container gets another role.
- Reversible: yes, by rotating the passwords and restarting.

## D-118 Backups connect as the postgres superuser, and restores only ever target a scratch database (lane M1)
- Decision: row level security is forced on the tables, so only a superuser can `pg_dump` all rows. The `backup` service therefore connects as `postgres` over the internal network and is in the `ops` profile, started only by cron. `ad-tool restore` refuses a target database named `ad`, `ad_keys` or the live names and restores into a scratch database, and the runbook then swaps traffic by hand. A restore test dumps a real database with a forced RLS table, encrypts it, restores it and compares rows.
- Options: grant a role BYPASSRLS for backups; dump with the owner role; restore in place.
- Why: BYPASSRLS on an application role would widen the blast radius of the role the worker runs as. A restore in place is the failure that turns a bad day into a lost database.
- Reversible: yes.

## D-119 Twelve original inline SVG avatars keyed by the stored avatar id (lane M2)
- Decision: profiles keep storing only `avatar_id`, one of the twelve existing ids (sun, moon, star, leaf, drum, book, kite, bird, fish, tree, cloud, spark). `@ad/ui` draws each as an original inline SVG on a tone tile, using ink, surface and accent tokens only, so it follows the theme. The profile form picks by avatar id. The old tone still works for profiles that have no illustrated id and for the letter fallback.
- Options: wait for client artwork, image files per avatar, inline SVG now.
- Why: the client has not supplied art, image files add requests on low data connections, and the id is the stable contract, so the drawings can be replaced later with no data change.
- Reversible: yes. Replace the shapes in `AvatarArt.tsx`.
- Gap: the top nav still shows the letter avatar, and the account overview has no profiles card yet.

## D-120 Segment url lifetime back to 2 hours, proven by a real browser journey (lane a3)
- Decision: signed segment urls last 2 hours (`SEGMENT_URL_SECONDS`), as M31-S01 AC1, M08-S21 AC1 and the original SECURITY.md said. This replaces the 6 hour acceptance in D-089 (L-3). `cap/` and `img/` stay unsigned (L-4 unchanged).
- Options: keep 6 hours, 2 hours, 30 minutes with a refresh timer.
- Why: D-047 and D-089 kept 6 hours because a VOD variant playlist is fetched once, so a paused or long watch would break. `apps/web/e2e/hls-real.stack.ts` ("a segment url that expired while the viewer waited") now shows real hls.js recovering: an expired url answers 403 from the real edge worker, the player mints a fresh session, reloads the playlist at the same position and plays on with no error shown, and an unpublished video ends on "This video is no longer available". With that proven, the shorter life costs nothing and shrinks the window a leaked unencrypted segment url works from 6 hours to 2. The edge still accepts 30 seconds past expiry for clock skew. A 30 minute lifetime was not taken because it adds a refresh round trip to every long watch for little extra safety, the AES key route stays the real gate.
- Reversible: yes, one constant or `segmentTtlSeconds`.

## D-121 Key route answers 401 for a missing or expired token and 403 for a foreign one (lane a3)
- Decision: M31-S02 AC2 says a refused key request answers 403. The key, master and variant routes keep 401 for a missing, malformed or expired playback token and 403 for a token that belongs to another video, an inactive kids profile or a failed same origin check. Every 401, 403 and 429 now writes a warn log line `playback denied` with route, status, video id and a truncated address, never the token. Publishing also requires the video's HLS key row.
- Options: answer 403 for every refusal, keep 401 and 403 as they are.
- Why: the player treats 401 as "mint a new token and retry once", which is the M08-S21 recovery path, and treats 403 as a final refusal. Collapsing them to 403 would turn every token expiry into a hard stop. The log line and the publish gate meet the rest of the story.
- Reversible: yes.

## D-122 Email retry runs in the request, with a provider outage alert and a bounce list (lane a3)
- Decision: M21-S01 asks for an outbox with a worker retrying up to 5 times. Mail still goes straight from the calling process (D-024). `RetryingTransport` now makes up to 5 attempts with waits of 0.25, 1, 3 and 8 seconds, never retries an SMTP 5xx answer, and an `OutageMonitor` writes an `email provider outage` error log once after 10 minutes of continuous failure. Bounces and complaints reach `/api/webhooks/email` (HMAC SHA256 in `x-webhook-signature`, closed until `EMAIL_WEBHOOK_SECRET` is set) and are stored as keyed hashes in `email_suppressions` (additive migration 0028). Only the welcome email is skipped for them; codes, resets and security notices always send. A welcome email goes out after the first verification.
- Options: build an `email_outbox` table and a pg-boss sender, keep one attempt.
- Why: an outbox is the right shape for a provider outage longer than the request, but it adds a table, a job and a state machine for a launch with one SMTP provider and low volume. In request retries cover the common blip, and the sign up flow already shows a clear "could not send" with resend. The cost is that a 15 second blip delays the request and a longer outage drops the email after the visitor sees the error. The alert is a log line the log shipper can page on.
- Reversible: yes. Swapping `RetryingTransport` for an outbox writer changes only the transport given to `Mailer`.

## D-123 Catalog reads are cached for 60 seconds in memory and revalidated with ETag (lane M2, M04-S05)
- Decision: browse pages, browse categories and the shared Home rows go through a per process `CatalogCache` (60 second limit, 500 entries, keyed by audience and query). Every audited admin change empties it, because `@ad/catalog` writes its audit rows through a wrapper that invalidates. Progress, My List and Continue Watching are added after the cache and are never stored in it. A failed read goes to the caller and is not answered from old data. The home, browse, categories and title API routes also send an `ETag` (hash of the body) with `private, no-cache`, and answer 304 when the client already has the version.
- Options: no cache, a shared cache such as Redis, cache the whole response per profile, `max-age` caching in the browser.
- Why: one self hosted web process serves the whole site, so memory is enough and has no new service. Caching only audience level data keeps personal rows correct. `no-cache` with a tag saves the body without ever showing a stale page in the browser.
- Reversible: yes. Leave `catalogCache` out of the viewer context to turn the server cache off.
- Gap: a second web instance would have its own cache and be up to 60 seconds behind an edit made on the first. A read that began just before a commit can store old data for up to 60 seconds. Caption approval does not audit through the wrapper, so the captions badge can lag by 60 seconds.

## D-124 Old addresses redirect permanently, and Remove from row can be undone from the database (lane M2)
- Decision: changing a video or series address leaves the old one in `slug_redirects`, refuses addresses in use or reserved (`admin`, `api`, `watch` and the site routes), and the viewer pages answer an old address with a permanent redirect, also for signed out visitors. The undo of "Remove from row" is stored in `watch_progress_removals` (migration 0029) for 5 minutes instead of server memory, once only, and never over newer progress.
- Options: keep the in memory undo, add a soft delete flag to `watch_progress`, a separate table.
- Why: the memory stash was lost on restart and on a second instance. A flag on `watch_progress` would touch every progress query. A small table with the same owner RLS keeps the change local.
- Reversible: yes. The table is small and only the undo reads it.

## D-123 Progress and key rate limits stay as built, with the reasons on record (lane a3)
- Decision: M08-S16 asks for 1 progress write per 5 seconds per profile with extras coalesced. The server keeps a bucket of 30 writes per minute per profile (`VIEWER_RATE_POLICIES.progress`) and answers 429 beyond it. M31-S02 AC3 asks for 30 key requests per minute per session. The key route keeps 20 per 10 minutes per profile and 300 per minute per address (ARCHITECTURE section 11, D-082).
- Options: a strict 1 per 5 seconds bucket that drops extras, a coalescing layer that holds the newest write, keep the current buckets.
- Why: pause, seek and tab hide each write at once (M08-S16 AC2), so a strict 1 per 5 seconds bucket would drop the final position, which is the one write that matters for resume. 30 per minute allows that burst, is five times the 6 per minute the 15 second tick (D-043) produces, and still caps abuse. The player keeps only the newest write per video while a write fails (progress.test.ts), so a 429 costs one retry, not data. For keys, hls.js asks once per video and the real browser seek storm in `hls-real.stack.ts` made at most 10 key requests across 10 seeks, so 20 per 10 minutes per profile blocks scraping, which 30 per minute would not.
- Reversible: yes, constants.

## D-124 Worker heartbeat in a table, read by a monitor endpoint (lane a3)
- Decision: the worker writes `worker_heartbeats('worker')` every 60 seconds (migration 0030, additive). `/api/health/worker` answers 503 when the last beat is older than 5 minutes or missing, and the external uptime monitor polls it with `/healthz` and `/readyz`. `/readyz` does not include it, so a stopped worker never takes the web app out of rotation.
- Options: add a worker check to `/readyz`, derive liveness from pg-boss job completion, a heartbeat file in the container.
- Why: a stopped worker should alert, not make the site unready. pg-boss completion needs a scheduled job and tells nothing on an idle queue. A file cannot be read by the web app or an external monitor. Alert dedupe, disk, error rate and certificate expiry alerts are monitor settings (DEPLOYMENT section 9), not code, so they stay a launch checklist item.
- Reversible: yes.

## D-125 Title page matches the mockup inside the design system limits (lane f3)
- Decision: the S18 title page uses the themeable display face and weight 700, not the mockup's Space Grotesk, which is outside the curated font list. The mockup deep blue heading colour maps to `--color-ink` (DESIGN-SYSTEM section 3). Sizes the scale has no token for (44px title, 15px and 17px text) are written as `calc(rem * var(--type-scale))` in `components/title/title.css` so the size factor setting still applies.
- Options: add Space Grotesk and a navy token, accept the face difference, add scale tokens for 15 and 17.
- Why: the doc is the source of truth and a font change needs the theme editor and font budget work. The visible difference is the letter shapes only. Layout, sizes, weights, colours, radii and spacing match.
- Reversible: yes.

## D-126 Title pages swap the bottom tab bar for a Back button and a sticky Play bar (lane f3)
- Decision: on `/title/*` the phone tab bar is hidden. The header gets a Back button (`TopNav onBack`, history back) and the page has a sticky Play bar above the screen bottom. New fixed token `--shadow-up` for the bar.
- Options: keep the tab bar and stack the Play bar above it, hide the tab bar as in the S18 mobile mockup.
- Why: the mockup shows no tab bar, and two stacked bars would take about 120px of a 740px screen. Back is one tap and Home and Browse stay in the header and footer.
- Reversible: yes (one condition in `ViewerChrome`).

## D-127 Title page states live in a route layout (lane f3)
- Decision: `app/(viewer)/title/[slug]/layout.tsx` renders `AppShell`, so `loading.tsx` (skeleton after 300ms), `not-found.tsx` and `error.tsx` keep the header and footer. The error card shows the Next digest as the reference.
- Options: wrap each state by hand, keep the global error page.
- Why: the mockups show every state inside the header and footer.
- Reversible: yes.

## D-128 Super admin role, superseding D-034 and the three role part of D-116 and D-025 (lane f1)
- Decision: `account_role` gains `super_admin` (migration 0031, additive). Order is viewer, editor, admin, super_admin and `can()` uses `roleAtLeast` from `@ad/shared`. Super admin only: invite staff, revoke invites, change or remove roles, reset another admin's 2FA (M12-S03, S05, S06, S07 screen), read the full audit log including security, staff and job entries and export it (M20-S02, S03), delete a viewer account at the owner's request with a typed word (M27-S03 AC3), change features and limits (M29-S02) and retry or discard failed jobs (M30-S03). Admin keeps content, theme, site settings other than features and limits, viewer support actions and the content scope of the audit log. Server side: `StaffService` reads the role from the database and refuses anything below `super_admin` for those calls, `staff_set_role` and the new `staff_request_account_deletion` re-check the caller in SQL, `keep_one_active_admin` now also refuses to demote, suspend or delete the last active Super admin (SQLSTATE 23514, shown as "There must be at least one Super admin"), nobody can change their own role, and `SettingsService` defaults `isSuper` to `super_admin`. `db:seed:admin` creates the first Super admin and refuses once one exists. Installs that already had admins use `pnpm db:seed:admin -- --promote` to promote one named admin, because a migration cannot use a new enum value in the transaction that adds it.
- Options: keep admin as the top role (D-034), a boolean `is_super` on accounts, a new enum value.
- Why: the stories and the launch plan name a Super admin (ARKDEV) separate from the client's admin, and an enum value keeps one ordered role everywhere (RLS, SQL functions, `can()`). A boolean would leave `role` meaning two things. The SQL re-checks mean a bug in the app layer cannot promote anyone.
- Reversible: yes while no real account holds the role. Removing an enum value needs a table rewrite.

## D-129 Email outbox for notification and export mail, auth mail stays direct (lane f1)
- Decision: migration 0032 adds `email_outbox` (kind, sealed recipient, template variables, status queued, sending, sent or failed, attempts, next attempt, lock time, provider message id, error text, dedupe key). The worker drains it every minute (`email.outbox`) in batches of 50 with `FOR UPDATE SKIP LOCKED`, up to 5 attempts with waits of 1, 5, 15, 60 and 180 minutes, and fails an SMTP 5xx at once. Sent rows are kept 30 days and failed rows 90. Staff notification email (M21-S03) and later export email use it. Sign in, verification, reset, invite, lockout and account mail stays in the request (D-024, D-122): a code or reset link must arrive while the person waits, and an outbox write would add a queue hop to every sign up and reset, and would make "address unknown" differ from "address known" in timing and in what the worker later logs. `staff_notification_prefs` gains `email_frequency` (immediate, hourly, daily, default hourly) and `address_enc`. The staff address is copied there sealed with `FIELD_KEK` and bound to the account id, because the worker has no access to `accounts`. The copy is saved the first time the bell loads, is cleared by a database trigger when the account email changes, and goes with the account. A new function `active_staff_ids()` (SECURITY DEFINER, ids only) lets the worker find recipients. The same migration grants the worker `admin_notices` and `staff_notification_prefs`, which were missing: bell notices written by the worker were failing in production without anyone seeing it, because `notifyStaff` swallows errors. "At once" means within a minute: the drain also queues those notices. Hourly summaries run at five past the hour and the daily summary in the 07:00 Lagos hour. The worker now needs `FIELD_KEK`, `SMTP_URL` and `EMAIL_FROM`, which it already shares with the web through the same env file. The outbox code lives in `@ad/queue` to avoid a new package.
- Options: move all email to the outbox, outbox for notification mail only, keep direct sending and only add summaries.
- Why: notification mail can wait a minute and is the mail that suffers when a provider is down. Auth mail is the opposite. The sealed copy uses the global field key, not a per account key, so shredding an account does not by itself destroy it: the trigger and the cascade remove it with the account, and outbox rows are pruned after 30 days.
- Reversible: yes. The outbox and the new columns are additive and can be left unused.


## D-143 The service worker keeps four public pages for the offline screen (lane f2)
- Decision: after a visit, `/about`, `/help`, `/terms` and `/privacy` are stored in the `ad-pages-v1` cache (network first, stored only when the response is cacheable). The offline screen links to the ones present. Every other page stays network only. The cache is wiped by the existing CLEAR_CACHES message on sign out and on profile switch.
- Options: keep D-039 (no page HTML at all, offline screen has only Try again); cache all visited pages; cache the four public pages.
- Why: M25-S04 asks for a link to cached pages. The four pages carry no catalog or progress data. They are rendered inside the app shell, which shows the active profile name, so the copy is cleared with the other private state.
- Reversible: yes, set `SW_SAVED_PAGES` to an empty list.
## D-144 Space Grotesk as the display face of the sign in and sign up screens (lane p1)
- Decision: S01 and S02 set headings, the brand name and the panel headline in Space Grotesk, self hosted from `apps/web/src/fonts` through `lib/auth-font.ts` (two variable subsets, latin and latin-ext, OFL licence kept beside them). It is exposed as `--font-auth-display` and used only inside the `.auth-root` scope, so body text keeps the theme font and no other page loads the files.
- Options: keep `--font-display` (Inter, so the headline looks lighter and wraps differently from the mockup), add Space Grotesk to the curated theme list, scope it to the auth screens.
- Why: the owner requires the screens to match the mockups exactly and the mockups use Space Grotesk. Scoping avoids changing the curated font list that the theme editor offers (docs/DESIGN-SYSTEM.md section 5) and keeps every other screen untouched.
- Reversible: yes. Delete `auth-font.ts` and point `--auth-display` at `--font-display`.

## D-145 Mockup measurements on S01 and S02 are literal pixels scaled by the type scale (lane p1)
- Decision: `components/auth/auth-ui.css` uses the mockup's sizes (15px labels, 26px and 28px titles, 56px panel headline, 48px inputs, 52px button, 600px panel) written as `calc(Npx * var(--type-scale))` for type so the admin size factor still applies. Colours, radii and borders stay tokens. Two scoped custom properties cover values with no token: `--auth-logo-glyph` (the play glyph colour in the logo, #12263A) and `--auth-card-shadow` (the mockup's 5 percent shadow, softer than `--shadow-1`). A CSS test fails if any other literal colour appears.
- Options: round to the nearest token step (visible drift from the mockup), add tokens for every one off size, scoped literals with a guard test.
- Why: exact parity was required and a token for a size used on two screens would not be reused. The guard keeps the exception small.
- Reversible: yes.

## D-146 Small, owner approved deviations from the 44px rule on S01 and S02 (lane p1)
- Decision: (a) the brand panel footer links keep the mockup's tight word spacing, so they are 44px tall and as wide as their text (at least 24px, WCAG 2.5.8) instead of 44px wide; (b) the Terms and Privacy links in the sign up fine print stay inline so the line wraps exactly like the mockup, with an invisible 44px hit area added by a pseudo element; (c) the session ended notice reads "Your session ended. Sign in again to keep watching." (info tone) as drawn in the mockup, replacing lane F2's longer wording, and the reset notice shows as a success banner; (d) on mobile the sign up submit sits in a sticky bar and "Already have an account?" is moved above it with CSS order, so DOM order is submit then link and visual order is link then submit.
- Options: pad the footer links to 44px wide (spacing no longer matches), turn the inline links into blocks (breaks the wrap), keep F2's copy.
- Why: the mockups are the spec and each deviation is invisible or tiny. All other targets are at least 44 by 44, checked in `e2e/touch-targets.e2e.ts` and `e2e/auth-pages.e2e.ts`.
- Reversible: yes.

## D-147 The account and site screens keep Inter as the display face (lane p3)
- Decision: S27 to S31 use `--font-display` (Inter), not the mockups' Space Grotesk. This is the one accepted visual difference on those screens. Sign in and sign up keep their scoped Space Grotesk from D-144.
- Options: copy D-144 and scope Space Grotesk to the account pages, add Space Grotesk to the curated theme list, keep Inter.
- Why: docs/DESIGN-SYSTEM.md and the review in DESIGN-REVIEW item 10 settle on the theme font for every signed in screen, so the client's font choice in the theme editor still applies. Sizes, weights and line heights are matched to the mockup.
- Reversible: yes. One `font-family` token in `account.css` and the site rules.

## D-148 Export keeps a password dialog; extra caption rows and the Password card stay (lane p3)
- Decision: requesting an export opens "Confirm your password" (M02-S07 needs the password), the mockup's single button stays as the entry point. The Password card on S28 stays visible after a successful change, with the success toast above it. Caption background and high contrast rows stay on S29 below caption size, because the player supports both.
- Options: remove the password step from export, replace the dialog with an inline field, keep the dialog; hide the Password card after success; drop the two extra caption rows.
- Why: the behaviour in the stories wins over a visual shortcut, and the dialog uses the same look as the mockup's delete dialog.
- Reversible: yes.

## D-149 Kids locked playback rows are enforced on the server (lane p3)
- Decision: `lib/playback-lock.ts` lists the rows a Kids profile cannot change (autoplay next episode, data saver). `savePlaybackAction` drops those keys before saving, and the page shows them as locked switches with "Set by your parent account."
- Options: disable the switches only in the UI, enforce in the action, enforce in the repository.
- Why: a disabled switch is not a rule, and the action is the one place every write passes through.
- Reversible: yes.

## D-150 The pending deletion screen moves to a closing layout (lane p3)
- Decision: `/account/deletion` now lives in the `(closing)` route group with the soft header (logo only, no links the account cannot use) and the support footer, as drawn in S30 state 6. The behaviour (Cancel deletion, Sign out, redirect when nothing is pending) is unchanged.
- Options: keep the logo and sign out bar of the profiles layout, show the full header, add a closing layout.
- Why: the mockup shows the header and footer; the full header links would all redirect back to this screen.
- Reversible: yes.

## D-151 About copy comes from the editable page, with an optional lead line (lane p3)
- Decision: S31 About draws the page title as the headline, the new optional `lead` as the intro and one card per section. Pages with admin HTML keep the article layout. Legal pages read "Last updated D. Reading time N min." as drawn.
- Options: hardcode the About text, store it in the theme, keep it in the legal page record.
- Why: the owner edits these pages; the mockup text is the fixture. `lead` is optional so existing saved pages still render.
- Reversible: yes.

## D-152 The soft header names the profile button from its visible text (lane p3)
- Decision: with `skin="soft"` the profile button has no aria-label. Its accessible name is the visible name followed by a hidden ", profile menu".
- Options: keep "Profile menu, Name" (fails label in name, WCAG 2.5.3), hide the visible name.
- Why: axe flagged the mismatch once the name became visible beside the avatar.

## D-130 Large exports are background jobs with a row ceiling (lane f1)
- Decision: audit and analytics exports over 10,000 rows go through a confirm page, a `staff_exports` row and the `exports.generate` job, and the requester gets a `staff_export_ready` outbox email with a download link. Files expire after 72 hours, failed rows after 7 days. The ceiling is 2,000,000 rows because the S3 `put` buffers the stream in memory. A requester may hold 3 open exports. The fixture data mode lists none and refuses requests.
- Options: keep inline with a cap, stream straight to the browser, background job with email.
- Why: the old cap truncated silently. A job removes the cap without holding a request open, and row level security plus a permission re-check on every open keeps files private to the requester.
- Reversible: yes.

## D-131 Monthly storage estimate is stored bytes plus the last 30 days of growth (lane f1)
- Decision: the System storage tab shows an estimate for the next 30 days as stored bytes plus bytes added in the last 30 days, against the existing `limits.storage_cap_bytes` setting (default 200 GB). It warns at 80 percent of the budget (usage or estimate) and turns danger at 100 percent of usage. A missing or non positive budget never warns. A failed usage query shows "Not available".
- Options: a separate budget setting, a linear fit over a longer window, reuse the dashboard cap with a 30 day pace.
- Why: one budget keeps the dashboard and System consistent, and the 30 day pace needs no new data. The estimate is rough by design and slightly behind because sizes come from catalog records.
- Reversible: yes.

## D-132 Backup retention is 14 daily plus 8 weekly, and the keys database stays at 14 days (lane f1)
- Decision: the main database keeps the newest backup of each of the last 14 days that have one, then one per week for 8 older weeks. The keys database keeps 14 daily and no weekly copies, with a hard 14 day age limit, because SECURITY section 10 says backups must not outlive shredded keys. Each backup gets a manifest (key, time, size, SHA-256) written after the upload, removed with it, and checked by the restore tool. `BACKUP_RETAIN_DB_DAYS` and `BACKUP_RETAIN_KEYS_DAYS` are replaced by `BACKUP_KEEP_DAILY` and `BACKUP_KEEP_WEEKLY`. A backup with no manifest (made before this change) restores as before.
- Options: apply 14 plus 8 to both databases (keeps shredded keys for 8 weeks, breaks the erasure promise), keep age based retention, a manifest only on the main database.
- Why: slots count days and weeks that have a backup, so an outage of the job cannot erode the good copies. The keys exception protects the account deletion promise.
- Reversible: yes.

## D-133 The DNS check treats Cloudflare addresses as a proxied pass and uses injected resolvers (lane f1)
- Decision: `pnpm dns:check` takes its lookups from an injected resolver, so the tests run offline. An app domain that resolves to Cloudflare addresses passes as proxied, because DNS cannot show the VPS behind the proxy; one that resolves to the given `--vps-ip` passes as direct; anything else fails. The media domain must resolve to Cloudflare and must not resolve to the VPS. A lookup that times out fails with a retry message and is never read as a missing record. DKIM selectors, the VPS address and the SPF include are flags, not production env variables, because they are launch time inputs and the provider names them. Cloudflare's published IPv4 ranges are listed in code and can be overridden.
- Options: require the VPS address to match (breaks when proxied), skip the address checks, read the selectors from new env variables.
- Why: Cloudflare proxying is the documented setup, and a check that fails on it would be ignored. A stale range list can only cause a false failure that is easy to see.
- Reversible: yes.

## D-134 Poster frames are scored, and variants gain AVIF and a stored blur (lane f1)
- Decision: the artwork step extracts six frames at the middle of each sixth of the video. Each gets a 0 to 100 score from a small greyscale copy: light (nothing at or below 10 of 255 or at or above 245), contrast and edge sharpness (a Laplacian filter), taking the lower of light and the mean of contrast and sharpness, so a black frame is 0. A frame under 35 is retried at two nearby points (4 percent of the duration either side) and the best is kept. The best frame becomes the default poster, ties going to the frame nearest the middle. A frame that cannot be scored is kept with no score. When every scored frame is under 35 the picker suggests uploading a picture. Images also get AVIF variants (quality 50) next to WebP and JPEG, and a blur placeholder (a 24 pixel wide WebP, stepped down until the data url is under 1 KB) stored in `assets.placeholder_blur`. Migration 0034 adds the blur column and `candidate_score`, with check constraints. The viewer lists AVIF first in a `picture`, and thumbnails ignore AVIF.
- Options: score with an external model, extract more frames and pick, store AVIF only, draw the blur on every card now.
- Why: the story asks for a simple score, so a cheap local measure keeps the encode job light. The blur is stored and exposed; drawing it on cards is a viewer change that can follow without another migration.
- Reversible: yes. Frames and variants can be regenerated.

## D-153 Message catalog lives in @ad/shared under a browser safe subpath (lane r1)
- Decision: user facing copy that is shared across screens lives in `packages/shared/src/messages` (`EN_NG`, `msg`, `createMessages`, `formatDuration`). Code imports it from `@ad/shared/messages`, never the package root, because the root pulls in node crypto. Keys are `area.kind.name`, text takes `{name}` params, a `{one, other}` pair is picked by `count`. A missing key falls back to English and logs once. A test scans the web app and the player for `msg('key')` calls and fails on a missing key or an unused catalog key.
- Options: a catalog in apps/web only (the player package could not use it), a third party i18n library, ICU message syntax.
- Why: the player and the web app both show messages, so the shared package is the one place both can reach. A tiny catalog keeps the bundle small and the text unchanged. The lint rule for hardcoded strings (AC2) is not built, so components with inline copy move over as they are touched.
- Reversible: yes.

## D-154 "Always ask who is watching" is a device cookie, not an account column (lane r1)
- Decision: the setting is the `ad_always_ask` cookie (one year, http only), flipped from Account by `setAlwaysAskAction`. Sign in forgets the remembered profile when it is on, and the picker no longer skips itself for a single profile account. Signing out leaves the cookie, because the story is about a shared tablet.
- Options: an account column synced to every device (needs a migration and would force the picker on a personal phone too), local storage (the server cannot read it at sign in).
- Why: the story names a shared family tablet, so the setting belongs to the device. A cookie needs no schema change and the server reads it where the choice is made. Clearing cookies resets it, which is acceptable.
- Reversible: yes. A column can replace the cookie later.

## D-155 The picker cache is local storage keyed to an account hint cookie (lane r1)
- Decision: the picker saves id, name, kids flag, tone, avatar and PIN flag (nothing else) to `ad.pickercache.v1` with the account id and a timestamp. It is ignored after 7 days or for another account, and the private state wipe at sign out removes it. The loading screen of `/profiles` draws the cache at once, using the non secret `ad_acct` cookie set at sign in to know whose cache it is. A failed refresh draws the cache with "May be out of date".
- Options: a service worker cache of the page (partitioning is hard, M03-S14), cache without an account check (a second person could see the first person's names), server only.
- Why: local storage is readable before the server answers and is already wiped at sign out. The hint cookie stops a list from a previous account showing when a session expired without a sign out.
- Reversible: yes.

## D-156 Cards draw the stored blur, then the colour, and the image fades in over it (lane r2)
- Decision: `Thumbnail` in `@ad/ui` and `ResponsivePoster` take `placeholderBlur` and `placeholderColor`. The blur is drawn as a scaled, blurred background layer under the image; with no blur the colour fills the frame; with neither the image behaves as before. When a placeholder is drawn the image starts hidden (`data-loaded="false"`) and fades in over `--motion-base` once it loads, with a ref check so cached images show at once. Values are checked before they reach a style: only a hex colour and a webp base64 data url pass. Reduced motion sets the token to near zero, so the fade is instant.
- Options: always hide until loaded (blank card if scripts fail), a CSS only animation on mount (runs before the image arrives), keep the plain colour.
- Why: the blur was already stored and returned (D-134). Hiding the image only when a placeholder exists means a card is never blank.
- Reversible: yes.

## D-157 A saved poster focus recuts the files on a new asset, and the old poster stays until it is ready (lane r2)
- Decision: saving a poster with a focus other than centre at 100 percent creates a new `thumbnail` asset (migration 0035: `cut_from`, `cut_focus`), copies the source into `recuts/<video>/<asset>` and queues `image.process`. The worker crops around the focus with `cropRect`, writes the variants, then points videos that still use the source with the same saved focus at the recut, and deletes older ready recuts of that picture that no video uses. Until then the video keeps the uncut poster. A repeat save with the same crop reuses the recut. The admin video keeps reporting the source as `posterId`, so the picker selection does not change. The picker preview now follows the same crop maths (`cropPreviewStyle`).
- Options: recut in place (the picker preview would double crop), recut on the fly at the CDN, store only the focus.
- Why: a new asset leaves the picker candidates untouched and makes a failed recut harmless. Hash named files stay immutable.
- Reversible: yes. The columns are additive.

## D-158 The hardcoded copy rule is opt in per file and the allowlist is exact text (lane r1)
- Decision: `ad/no-hardcoded-copy` (scripts/eslint-rules/no-hardcoded-copy.mjs) is an error in a named list of wired files in eslint.config.js. It flags JSX text with letters, JSX aria-label, title, placeholder, alt and aria-description literals, and strings or templates that read like a sentence (capital first, two or more words) unless they sit inside `msg(...)`. The `allow` option takes exact strings that are not copy and is empty today. A file joins the list in the same change that moves its copy to the catalog, so lint stays green on main.
- Options: warn everywhere (hundreds of existing hits, noise gets ignored), error everywhere (blocks every lane), a regex script outside ESLint.
- Why: an opt in list ratchets: it can only grow, and it never blocks files that are not moved yet. The player files now on the list had about 45 inline strings, all moved to the catalog with text unchanged.
- Reversible: yes.

## D-159 The 3G budget is measured on the fixture build with Chrome Fast 3G figures and warm static files (lane r1)
- Decision: `apps/web/e2e/picker-cache-3g.e2e.ts` uses CDP network emulation with Chrome's Fast 3G numbers and asserts the picker tiles are visible within 2000 ms on a repeat visit. It is not part of the CI job list yet.
- Options: Slow 3G (500 kbit/s, 2 second target not reachable by any page with JavaScript), cold cache on every run (the story says previous visit), Lighthouse only.
- Why: the story says a 3G connection and the cached list from the previous visit. Fast 3G is the profile Chrome calls 3G, and a repeat visit has warm static files. The fixture server hides server time, so the real stack needs a check at staging.
- Reversible: yes.

## D-160 Hero art takes the poster focus, cut from its own source, and the preview uses the real source shape (lane r2)
- Decision: saving a poster focus also recuts the video's hero image (`hero_asset_id`) when it has one, through the same recut asset mechanism as the poster (a `hero` purpose asset with `cut_from` and `cut_focus`, from the hero's own source). The worker switches `hero_asset_id` when the recut is ready, and a focus back at the centre points the video at the hero source again. Series hero art is not covered, because series have no saved focus. For pictures that are not 16 by 9, the image worker also stores a small webp of the whole picture, flagged `full` in `assets.variants`, and the poster picker previews that picture with the real source shape (`previewRatio`). The viewer never gets the flagged variant. Pictures processed before this change have no full preview, so their crop preview stays an approximation until they are uploaded again.
- Options: a hero focus column of its own, recut series hero art too, preview from the original through a signed admin route, backfill every old asset.
- Why: the story says the saved focus applies to all variants, and the hero is the only other variant that exists. A flagged variant needs no migration and no signed route.
- Reversible: yes.

## D-161 A failed poster recut keeps the old poster and tells staff through the existing failure notice (lane r2)
- Decision: when `image.process` fails for good on a recut, the asset is marked failed and the video keeps the poster it had. If the video still waits for that crop, staff get a bell notice (kind `encode_failed`, title "Poster crop could not be applied", linked to the poster page). The poster picker shows a red banner while the recut is failed and a quiet one while it is still being made, from `posterRecut` on the admin video. Saving again makes a fresh recut; a failed one is never reused, and failed leftovers are removed when a later recut succeeds.
- Options: a new notice kind (needs a migration for the check constraint and a change in the digest), retry the job forever, fail the whole poster save.
- Why: reusing the failure kind keeps the bell, the digest and their checks unchanged. The old poster stays because a recut is an improvement, not a requirement.
- Reversible: yes.

## D-162 Space Grotesk is the default heading font, a curated and themeable entry (lane r3)
- Decision: the mockups S03 to S31 set every h1 to h3 and the brand name in Space Grotesk and body text in Inter, so Space Grotesk becomes a curated font key (`space-grotesk`) that is display only, like Lora: body text stays Inter and `--font-display` becomes Space Grotesk. It is the default `fontKey` of `DEFAULT_THEME`, so every preset inherits it. Choosing Inter, DM Sans, Poppins or Nunito in the theme editor sets headings to the body font again. The files stay self hosted (`apps/web/src/fonts`, two variable subsets, OFL licence beside them) and are loaded through `lib/fonts.ts` only when the theme selects the key. D-144 is superseded: the auth screens use `--font-display` and `lib/auth-font.ts` is removed. D-147 is superseded: S18 and S27 to S31 follow the theme display font, which now matches the mockups.
- Options: copy D-144 scoping to each page group (heading font not themeable, one more font class per layout); a separate heading font setting (new theme field and migration); a curated display only entry with the default switched (chosen).
- Why: one mechanism, themeable, no schema change, same files as before. The contrast gate does not read the font, and a test now asserts the gate result does not change with the font. Existing stored themes keep their saved key (Inter), so only new installs and a theme reset get Space Grotesk headings.
- Also: the closing layout (pending deletion screen) gets the soft footer rules, and the Kids adults only card sits inside the `acct` scope so its heading token applies (it rendered at 16px). The pending deletion screen keeps the logo only header (M02-S08) where the mockup shows the full nav, because an account in grace cannot use the links.
- Reversible: yes. Set `DEFAULT_THEME.fontKey` back to `inter`.

## D-163 SMTP_URL=disabled is the supported no email mode, and auth mail is not written to the outbox (lane w1)
- Decision: `SMTP_URL` accepts the exact word `disabled` (any letter case, stored lowercase) besides smtp and smtps urls. An empty or missing value still fails startup. In disabled mode web and worker use a `DisabledTransport` whose every send throws `EmailNotConfigured` ("Email is not configured. Set SMTP_URL to enable sending."). The retrying transport does not retry it and the worker outbox treats it as permanent, so queued rows close as `failed` with that text at once. The admin dashboard shows the existing warning Banner "Email is not configured". `pnpm dns:check` adds a failing `email-configured` check and skips SPF, DKIM and DMARC, and the runbook smoke checklist lists it as a launch blocker.
- Options: a separate `EMAIL_DISABLED` flag (two settings that can disagree), writing verification and reset mail to the outbox as failed rows, accepting an empty `SMTP_URL`.
- Why: one value, strict by default, visible in three places. Verification and reset mail is sent straight through the mailer, not through the outbox, and the outbox only has staff notice kinds and a kind check constraint. Storing reset and verify links as rows would need a migration and would keep single use secrets at rest, so the failure is raised and logged instead. Outbox rows the worker does hold are failed with the clear text.
- Reversible: yes. Remove the transport branch and the schema alternative.

## D-164 Images are released by a separate on demand workflow, scanned with a pinned Trivy container, pushed only if the scan passes (lane w1)
- Decision: `.github/workflows/release.yml` runs on workflow_dispatch and v* tags only. Each of web, worker, whisper, tools is built for linux/amd64 into the local store, scanned with `ghcr.io/aquasecurity/trivy:0.69.3` (CRITICAL with a fix fails the job), then pushed with the full sha, the short sha and the tag name. Login uses `GITHUB_TOKEN` with `packages: write`.
- Options: add image jobs to ci.yml on every push to main (slow, fills GHCR with untested shas), the trivy-action (its tags were hijacked in March 2026, GHSA-69fq-xp46-6x23), push first and scan after.
- Why: the owner decides which sha goes live, a bad image never reaches the registry, and the scanner is a version the advisory names as safe. Bump `TRIVY_IMAGE` deliberately.
- Reversible: yes.

## D-165 The worker image needs drizzle-orm at run time (lane w1)
- Decision: `drizzle-orm` moves from devDependencies to dependencies in `apps/worker/package.json`.
- Options: leave it (the image installs with `pnpm deploy --prod`, so the worker crashed at boot with ERR_MODULE_NOT_FOUND from `src/notifier.ts`), or import it only through `@ad/db`.
- Why: smallest correct change, found by running the deployed layout locally. Reversible: yes.

## D-166 The tools and the theme package import the pure @ad/ui/theme entry (lane w2)
- Decision: `@ad/ui` gets a `./theme` export pointing at `src/theme.ts`. `packages/launch` and `packages/theme` take their runtime values from it instead of the `@ad/ui` barrel. A guard test fails if a runtime import of the barrel comes back.
- Options: add a tsconfig with the automatic JSX runtime to the tools image (tsx ignores files under node_modules unless the config includes them, and it keeps React in the image for no reason), or split the barrel.
- Why: found on the first real `apply` on the VPS, which crashed with "React is not defined" from `AvatarArt.tsx`. The tools only need colour and font keys, so they should not load any component. Reversible: yes.

## D-167 The whisper image installs requests and logs why a transcription failed (lane w3)
- Decision: `requests` is pinned in `apps/whisper/requirements.txt`, and the whisper server prints the traceback of a failed transcription to its own log. The caller still only sees "transcription failed".
- Options: pin an older huggingface_hub that still pulls requests in, or install requests directly.
- Why: found on the first real caption run on the VPS. faster-whisper 1.1.1 imports requests when it loads, the image did not have it, every caption job failed with a bare 500 and the service log said nothing. Reversible: yes.

## D-168 The whisper image pins av to 13.1.0 (lane w4)
- Decision: `av==13.1.0` is pinned in `apps/whisper/requirements.txt`, with a guard test.
- Options: pin an older faster-whisper, or pin av alone.
- Why: found on the second real caption run on the VPS. faster-whisper 1.1.1 asks for any `av>=11`, the image installed PyAV 19, and PyAV 19 removed the `metadata_errors` argument that faster-whisper passes, so decoding failed with a TypeError. Checked locally with a clean install: model load, decode and transcribe with word timestamps all run. Reversible: yes.

## D-169 Hausa headings use Inter, extending R23 (lane L7 review)
- Decision: headings in Hausa render in Inter, as R23 already does for Yoruba and Igbo.
- Options: leave Hausa on the display font, or add the hooked letters to every family.
- Why: five of six curated families lack ɓ ɗ ƙ ʼ, and Inter has them. Subsetting every family is larger and slower.
- Reversible: yes, one font rule.

## D-170 Table alignment rule (lane L3, L3-D01)
- Decision: Numbers right aligned with right aligned headers (`adm-num`), Yes or No marks centred (`adm-ctr`), row actions right (`adm-actions`), everything else left. Header and cells of a column share one class.
- Options: Left align everything, centre numbers.
- Why: Matches DESIGN-SYSTEM 11.16 and fixes the CSS specificity bug (`.adm-table th` beat `.adm-num`) instead of moving headers. Reversible: yes, CSS only.

## D-171 One Breadcrumbs component in @ad/ui (lane L3, L3-D02)
- Decision: Admin `PageHeader` and the viewer title page use one `Breadcrumbs` component. Current crumb truncates at 40ch, phones show only the parent. Links and the current crumb follow R32.
- Options: Patch both copies.
- Why: The defect was a duplicated pattern. Reversible: yes.

## D-172 Tables on phones (lane L3, L3-D03)
- Decision: Wide tables scroll sideways inside their card with a sticky first column. Captions, Trash and Users get stacked cards when their slices land.
- Options: Scroll everywhere, cards everywhere.
- Why: DESIGN-SYSTEM 11.16 and one handed use on low end phones. Reversible: yes.

## D-173 Bulk mechanics constants (lane L3, L3-D04)
- Decision: 25 ids per chunk, 200 per server call, 500 per selection, 50 for account actions, 20 for invites.
- Options: One big call.
- Why: Survives timeouts on slow connections, shows progress, caps blast radius. Reversible: yes, constants.

## D-174 Selection across pages (lane L3, L3-D05)
- Decision: Page scope by default. Select all that match (filter snapshot, up to 500 ids) only for non destructive reversible actions: category, suitability, captions availability, Restore.
- Options: Never allow it, always allow it.
- Why: Saves ticking pages without letting someone change what they cannot see. Reversible: yes.

## D-175 Partial failure (lane L3, L3-D06)
- Decision: Each item succeeds or fails alone, except suitability (already all or nothing) and staff disable (all or nothing).
- Options: Everything all or nothing.
- Why: One bad row never blocks the rest, security changes never half apply. Reversible: yes.

## D-176 Undo (lane L3, L3-D07)
- Decision: A 10 second toast, client memory only, compare and set on the server. Offered for trash, restore, publish, unpublish, category, suitability, captions availability, suspend, reinstate, series publish. Not for approve captions, delete forever, retry or staff changes.
- Options: No undo, undo everywhere.
- Why: Only where reversal is cheap and safe. Reversible: yes.

## D-177 Bulk audit shape (lane L3, L3-D08)
- Decision: One `bulk.run` summary row plus each item's normal row carrying `extra.bulkId`.
- Options: Summary only, items only.
- Why: The log stays searchable by item and by run. Reversible: yes.

## D-178 Bulk approve of captions (lane L3, L3-D09)
- Decision: Admin only (R21). Skip failed, generating, none, approved and tracks with warnings. Untouched auto captions need a ticked acknowledgement.
- Options: Editor allowed, block untouched entirely.
- Why: Clears a backlog without publishing wrong names by accident. Reversible: yes.

## D-179 Bulk retry of encodes (lane L3, L3-D10)
- Decision: Only jobs whose original file still exists, oldest failure first, one at a time. New action `encode.retry` at editor level.
- Options: Retry everything.
- Why: Matches M14-S07 and M14-S09 AC4. Reversible: yes.

## D-180 Users and staff bulk actions (lane L3, L3-D11)
- Decision: Viewer accounts: suspend with one shared reason, reinstate, force sign out, resend verification, no bulk delete. Staff: Super admin only, re-auth once, Editor and Admin only, never self, never to or from Super admin, disable all or nothing, invite resend with a one hour cooldown.
- Options: Wider sets.
- Why: Safest set that removes repeat clicks. Reversible: yes.

## D-181 Series bulk actions (lane L3, L3-D12)
- Decision: Bulk publish, unpublish, delete (typed count, no undo, new `series.delete` at admin). No series Trash because delete removes seasons. Editors can no longer delete a series.
- Options: Add soft delete.
- Why: A restore needs a schema change. Reversible: yes.

## D-182 Trash bulk actions (lane L3, L3-D13)
- Decision: Bulk restore and delete forever with a typed count. Purge stays admin and M16-S06 is corrected.
- Options: Super admin only.
- Why: Docs follow the shipped matrix. Reversible: yes.

## D-183 Bulk upload details (lane L3, L3-D14)
- Decision: Shared details with per file overrides. Publish later means publish when ready with an optional not before time and never bypasses the caption gate.
- Options: Schedule a time.
- Why: Nothing is publishable at upload time. Reversible: yes, drop `publish_intent`.

## D-184 Captions On, Off or Follow site default (lane L3, L3-D15)
- Decision: Per video tri state `captions_enabled`, site default `captions.defaultAvailable` (Super admin), Admin changes the video with a reason for Off, Off satisfies the publish gate and hides tracks and the CC button, admin can still process captions, profiles keep their saved choice. Approved VTT URLs stay reachable for anyone who has one.
- Options: Viewer toggle only, per video flag only.
- Why: From the audit's resolved option (R22). Reversible: yes.

## D-185 Doc and code mismatches fixed in docs (lane L3, L3-D16)
- Decision: Encoding retry is editor level and Delete forever is admin level; SECURITY.md and M16-S06 are corrected, code unchanged.
- Options: Change the code.
- Why: The code matches the stories and the UI. Reversible: yes.

## D-186 Status ink tokens (lane L3, L3-D17)
- Decision: Add `--color-info-ink` #14568F, `--color-success-ink` #14532D and `--color-warning-ink` #5E3D00 to tokens.css, DESIGN-SYSTEM section 3 and the theme editor Fixed group.
- Options: Keep raw hex values in screens.
- Why: Review finding F11: text inks on status tints must be tokens. Contrast 6.63, 7.99 and 8.88. Reversible: yes.

## D-187 Duplicate decision ids are registered, not renumbered (lane L8, DEC-L8-10)
- Decision: D-108, D-109, D-123 and D-124 keep both entries. A register at the top of this file disambiguates them and `scripts/decisions-ids.test.ts` blocks new duplicates.
- Options: renumber the later entries, or register them.
- Why: lane notes, code comments and PRs cite these numbers, so renumbering breaks them.
- Reversible: yes.

## D-188 Hero rotates every 10 seconds by default, with Pause (lane L8, DEC-L8-09)
- Decision: auto rotate is on, 10 s per slide, paused by hover, focus, touch and the Pause control, off under reduced motion and Data saver. The doc and M05-S01 now say 10 s.
- Options: off by default (old design system), 8 s (old stories and code).
- Why: owner punch list item 6 and ruling R12.
- Reversible: yes.

## D-189 Cards stay 16:9 and the up next countdown default stays 5 s (lane L8, DEC-L8-03 and DEC-L8-12)
- Decision: video and series cards are 16:9 and the 2:3 poster is reserved, not used in v1. The up next countdown default is 5 s with a site setting of 5 to 10 s. The design system text was corrected to match the code.
- Options: 2:3 posters for series, an 8 s countdown.
- Why: all source art is 16:9 and hero art has its own cut (D-160). The code and ruling R15 give 5 to 10 s.
- Reversible: yes.

## D-190 Seek rail rests at 5 px, grows to 8 px, hit area 44 px (lane L4)
- Decision: the seek rail rests at 5 px and grows to 8 px on hover, drag and focus, animated with transform only. The hit area is the 44 px touch target token.
- Options: keep 4 px and 32 px, or follow the audit and R30.
- Why: the old values contradicted the design system and the touch target rule. A fixed 8 px rail scaled in Y keeps the animation off layout.
- Reversible: yes, CSS only.

## D-191 Player rail and buffer lifted together, three new player tokens (lane L4)
- Decision: `--color-player-rail` becomes `#6A6E78` (3:1 on the player surface, R34) and `--color-player-buffer` becomes `#9CA0AA`. New tokens `--color-player-border` (`#3A3D46`), `--color-player-surface-raised` (`#1B1D24`) and `--color-player-switch-off` (`#6E7179`). Menu borders, the ring track and dividers move to the border token.
- Options: lift the rail only, or lift both and add tokens.
- Why: lifting only the rail would make the buffered fill darker than the empty rail. Borders must keep their old value.
- Reversible: yes, token values.

## D-192 Control scrim holds 0.9 up to the rail and sits below the skip button, tile, menus and toasts (lane L4)
- Decision: the scrim is a pseudo element of the player, 0.9 from the bottom to 58 percent of its height then easing out, z-index 1. The tile is 2, the controls (with their menus) 3, toasts 4. Captions rise 6.5 rem while the controls show.
- Options: keep the 0.95 fade on the control bar, or hold to the rail.
- Why: the old fade left the time label at 4.19:1 on a bright frame, and a scrim on the bar itself paints over anything above it.
- Reversible: yes.

## D-193 Two ring focus on controls that sit on the picture (lane L4)
- Decision: focus is a 3 px yellow outline with a 3 px dark inner ring (box shadow). Forced colours use a Highlight outline and no shadow.
- Options: yellow only, two rings, or a dark chip behind the Skip button.
- Why: yellow alone is 1.06 to 1.24:1 on a bright frame. A chip would change the approved look.
- Reversible: yes.

## D-194 Guests browse and play with no account (lane L1)
- Decision: Anyone can browse, search and play without an account. Accounts are only for My List, likes and ratings, cross device progress, profiles and the kids lock. The setting `features.guest_play` (default on, Super admin) returns playback to sign in without a deploy while browsing stays open.
- Options: keep sign in for everything, browse only, browse and play.
- Why: Owner rule R01. Removes the biggest drop off. The AES key and signed urls still stop casual hotlinking, and the switch is the emergency fallback if the edge or VPS is overrun.
- Reversible: yes, one setting.

## D-195 Guest identity is a signed cookie set only by the playback session route (lane L1)
- Decision: A guest is a random 128 bit id in the cookie `__Host-ad_guest` (`ad_guest` when not secure), HttpOnly, SameSite Lax, 180 days, MAC label `ad:guest:v1` with a key derived from the existing profile cookie secret, so no new environment variable. It is minted only inside `POST /api/play/[id]/session`, after the same origin check, never in a page render and never on a browse only visit. A forged, truncated or foreign cookie counts as absent.
- Options: no identity (IP only), signed cookie on first play, cookie on first visit, id kept only in localStorage.
- Why: Per guest limits work, browsing sets no cookie, and the server can read it. IP only would punish shared mobile networks. Server components cannot set cookies, so the plan wording 'set on first play' means the route handler.
- Reversible: yes, remove the guest branch and the cookie expires.

## D-196 Guest playback token claims (lane L1)
- Decision: A guest token has `aid` = guest id, `pid` null, `gst: true` and, in Kids mode, `kd: true`. It never carries `pv`: the issuer refuses guest plus preview and the verifier rejects a token with both `gst` and `pv`. Old tokens verify unchanged. The key route skips the profile lookup for guests, limits on the guest id and re-checks `kd` against the video.
- Options: a fake account id, or guest claims on the existing token.
- Why: No placeholder account to trip over in policies, and the existing key limiter already uses `pid ?? aid`.
- Reversible: yes.

## D-197 Guest segment urls last 20 minutes and guest sessions are limited per guest and per address (lane L1)
- Decision: Guest segment urls use `limits.guest_segment_minutes` (default 20, 5 to 120, Super admin). Account urls stay at 2 hours (D-120). New limiter policies: 20 sessions per minute per guest id and 120 per minute per address. The edge Worker is unchanged and a test pins that forged and expired signatures are still refused.
- Options: same 2 hours, 20 minutes, 5 minutes.
- Why: Shrinks the window a shared guest url works. D-120 proved the player recovers from an expired url by minting a new session, which a guest can do because the cookie is there. The address limit is generous because mobile networks share addresses.
- Reversible: yes, a setting.
## D-198 Skip markers and chapters live in two tables, not a jsonb column (lane L4)
- Decision: `video_markers` (one row per kind) and `video_chapters` (ordered by `start_ms`), both cascading from `videos`. Migration 0036, additive.
- Options: tables, or a jsonb column on `videos`.
- Why: the database enforces kind, ordering and uniqueness, each save is audited, deletes cascade and the query by video is trivial.
- Reversible: yes, drop both tables. Nothing else references them.

## D-199 A credits marker may have no end, intro and recap need one (lane L4)
- Decision: a null `end_ms` on credits means "to the end of the video". Intro and recap must have an end, at least 3 seconds after the start.
- Options: always require an end, or allow null on credits.
- Why: a replaced video of another length never leaves a stale credits window.
- Reversible: yes.

## D-200 Marker and chapter edits apply to published videos at once (lane L4)
- Decision: saving markers and chapters takes effect for viewers immediately, with no republish step. `MarkerService.getPublished(videoId)` takes no viewer, so guests and accounts use the same call.
- Options: require a republish, or apply at once.
- Why: corrections are small and frequent and the data is display only. Skip only seeks forward, so a bad marker never hides content.
- Reversible: yes.

## D-201 Guest progress lives in one localStorage key with a cap of 100 (lane L1)
- Decision: Guest watched places are kept on the device in the single key `ad:guest:progress:v1` as `{ v: 1, items: { [videoId]: { p, d, f, t } } }`, capped at 100 titles with the least recently written dropped first. A corrupt, blocked or full store is treated as empty and never stops playback, and the unsaved place is reported once ("Your place is not being saved on this device."). The session transport and the progress transport are separate types: the plan said transport mode `local`, but `PlaybackTransport` drives both the session provider and the sink, so progress got `ProgressTransport = 'http' | 'fixture' | 'local'`.
- Options: per video keys as the fixture sink does, one capped key, IndexedDB.
- Why: A cap and eviction need one place, one read is cheap on low end phones, and the version field allows a later migration. IndexedDB adds async code for no gain at 100 small entries. The existing local sink writes one key per video with no timestamp and no cap, so it could not meet the cap.
- Reversible: yes, the version field allows a migration.

## D-202 Guest analytics identity is a daily hash of the guest id (lane L1)
- Decision: Analytics hashes `guest:<guest id>` with the Lagos day, so a guest counts as one unique viewer per day and the id itself is never stored. A guest in Kids mode stores no identity, as a kids profile does. A signed in profile always wins over a guest cookie. The ingest context carries an optional `subjectId` and the guest view row keeps `profile_id` null.
- Options: guests uncounted as uniques, a daily hash of the guest id, an address based id.
- Why: Most viewers will be guests, so uncounted guests would hide most uniques. A daily rotating hash keeps the M19-S07 promise. An address based id is weaker and personal data under the NDPA.
- Reversible: yes.

## D-203 The catalog serves guests through separate account free functions (lane L1)
- Decision: Guests are served by functions that take an audience and no actor (`guestTitleDetail`, `getGuestHome`, `guestBrowse`, `guestCategories`, `guestSearch`, `guestSuggest`, `guestPopular`, `guestTitlesByIds`). They share the internals of the account path (`buildHome`, `browseFor`, `categoriesFor`, `searchFor`) with a null profile id, run in a plain transaction with no `withAccount`, and never touch a row level security table. Guest search writes nothing. In the web data layer the plan's `GuestViewerContext` union became an optional `guest: true` on the existing `ViewerContext` (`guestContext(audience)`: empty account id, profile `none`), because the union would have forced a change in every consumer and the fixtures already work from `ctx.audience` alone. `LibraryRepository` stays account only and a `guestLibrary` answers reads with nothing and refuses writes.
- Options: a placeholder account and profile for guests, or separate guest functions sharing the same internals with no actor.
- Why: A fake account would sit in policies and tests as a trap. A path with no actor cannot reach the personal tables, so a bug there fails closed.
- Reversible: yes.

## D-204 Public GETs use the same routes with a guard that prefers the account (lane L1)
- Decision: `/api/home`, `/api/browse`, `/api/browse/categories`, `/api/search`, `/api/search/suggest`, `/api/titles/[id]` and the new `/api/titles/batch` use `publicGet`: a request with a session runs the existing personal handler unchanged, anything else runs the guest handler with the device audience. GET and HEAD only (405 otherwise). Guests are limited on the existing `api` bucket per address (`guest-ip:<ip>`) and per verified guest id, and on the `search` bucket for search routes. A `profileId` or `record` a guest sends is dropped by the guest schemas. Signed in requests to the batch route get no cards, because accounts have a server side Continue Watching. Personal routes keep the 401 guard.
- Options: new `/api/public/*` routes, or the same routes with a personal first guard.
- Why: One URL per resource, the client code does not branch, and the personal path is not touched. A limiter failure is passed on as an error, never treated as a bypass.
## D-205 Theatre mode is a device level layout choice owned by the watch page (lane L4)
- Decision: theatre mode is stored in `localStorage` key `ad.player.theatre` (on or off) and applied as `data-theatre` on the watch layout. The player only offers the button and the T key, and only from 960 px with a fine pointer, never in full screen and never when the host passes no handler (the admin preview opts out).
- Options: a profile setting, or a device choice.
- Why: it describes this screen, like volume, so it needs no schema or sync and works for guests.
- Reversible: yes.

## D-206 Skip is a button with the S key, fades after 8 seconds idle, and nothing skips on its own (lane L4)
- Decision: the Skip button fades after 8 seconds without hover or focus, returns on pointer or key activity, uses the S key on desktop, and a skipped window is not offered again until the viewer seeks back before its start. There is no automatic skipping of intros.
- Options: always visible, timed, or a per profile "skip intros automatically".
- Why: fewer settings and no surprise on lessons where the intro carries content. Revisit if viewers ask.
- Reversible: yes.

## D-207 Standalone Up next uses the related list, and autoplay next defaults on except for kids profiles (lane L4)
- Decision: a standalone video gets its Up next from the related titles in order, skipping the current video and anything this profile has finished. The related list already follows the viewer's audience, so a kids profile never gets a title that is not kids safe. A guest receives the ordered choices and the device picks the first one it has not finished. `loadPreferences` turns autoplay next on for adult profiles and off for kids profiles unless the profile says otherwise (R15).
- Options: leave standalone videos with no next title, or rank by a recommender.
- Why: M08-S13 AC4 asks for a next title, the related list is already audience safe, and a recommender is out of scope for a free first release.
- Reversible: yes.

## D-208 Guest chrome lives in its own components and the title pages branch on viewer kind (lane L1)
- Decision: A visitor without an account gets `GuestChrome` (header with Home, Browse, My List, search, Sign in and Create account when sign up is open; Primary tab bar; footer; skip link) from `AppShell`, in `apps/web/src/components/guest/`. The plan's `TopNav` `guest` prop was not used: it would have edited the shared `@ad/ui` TopNav that other lanes are changing, and the guest header has no profile menu to share. Title, series and watch pages use `getViewerOrGuest`; a guest sees the full page with the Sign in to save dialog behind My List (no `aria-pressed`, `aria-haspopup="dialog"`), and the Play button follows the place kept on this device (Play, Resume from m:ss after 5 seconds, Watch again). The old signed out preview with Sign in to watch stays only for `features.guest_play` off. A successful sign in clears the service worker caches, as sign out does. The over-hero header backing for the home page ships with slice 5, and the Kids toggle in the menu with slice 6.
- Options: a `guest` prop on the shared TopNav, or a separate guest header.
- Why: Keeps other lanes free of conflicts in `@ad/ui` and keeps guest and account chrome from sharing state they do not both have.
- Reversible: yes.

## D-209 Table alignment rule (lane L3)

Options: left everything; right align numbers with right aligned headers (chosen); centre numbers. Why: matches DESIGN-SYSTEM 11.16 and fixes the CSS specificity bug rather than moving headers. Reversible: yes (CSS).

## D-210 One breadcrumb component in `@ad/ui` (lane L3)

Options: patch both copies; shared component (chosen). Truncate current page at 40ch on desktop, show only the parent on phones. Why: the defect was a duplicated pattern. Reversible: yes.

## D-211 Tables on phones (lane L3)

Options: scroll everywhere; stacked cards everywhere; cards for Captions, Trash, Users and scroll with a fixed first column for wide tables (chosen). Why: DESIGN-SYSTEM 11.16 and one handed use on low end phones. Reversible: yes.

## D-212 Bulk mechanics (lane L3)

25 ids per chunk, 200 per server call, 500 per selection, 50 for account actions, 20 for invites. Options: one big call; chunked (chosen). Why: survive timeouts and slow Lagos connections, show progress, cap blast radius. Reversible: yes (constants).

## D-213 Selection across pages (lane L3)

Options: never; always; only for non destructive reversible actions with a filter snapshot (chosen). Why: saves ticking pages without letting someone delete what they cannot see. Reversible: yes.

## D-214 Partial failure (lane L3)

Each item succeeds or fails alone, except suitability (already all or nothing, M35-S04) and staff disable (all or nothing, security). Why: one bad row never blocks the rest, but security changes never half apply. Reversible: yes.

## D-215 Undo (lane L3)

10 second toast, client memory only, compare and set on the server, offered for trash, restore, publish, unpublish, category, suitability, captions availability, suspend and reinstate, series publish. Not offered for approve captions, delete forever, retry, staff changes. Why: only where reversal is cheap and safe. Reversible: yes.

## D-216 Audit shape (lane L3)

One `bulk.run` row plus every item's normal row with `extra.bulkId`. Options: summary only; items only; both (chosen). Why: the log stays searchable by item and by run. Reversible: yes.

## D-217 Bulk approve captions (lane L3)

Admin only; skip failed, generating, none, approved and tracks with warnings; acknowledgement required for untouched auto captions. Options: Editor allowed; block untouched entirely; warn and acknowledge (chosen). Why: Sister Vanessa can clear a backlog, wrong names are not published by accident. Reversible: yes.

## D-218 Bulk retry (lane L3)

Only jobs with the original file, oldest first, one at a time, new action `encode.retry` at editor level. Why: matches M14-S07 and M14-S09 AC4. Reversible: yes.

## D-219 Users and staff bulk (lane L3)

Viewer accounts: suspend with shared reason, reinstate, force sign out, resend verification, no bulk delete. Staff: Super admin only, re-auth once, Editor and Admin only, never self, never to or from Super admin, disable all or nothing, resend invites with a one hour cooldown. Why: the safest set that still removes repeat clicks. Reversible: yes.

## D-220 Series (lane L3)

Bulk publish, unpublish, delete (typed count, no undo, new `series.delete` admin). No series Trash because delete removes seasons and a restore needs a schema change. Behaviour change: editors can no longer delete a series. Reversible: yes (add soft delete later).

## D-221 Trash (lane L3)

Bulk restore and delete forever with typed count; purge stays admin and the doc is corrected (M16-S06 said Super admin). Why: docs follow the shipped matrix. Reversible: yes.

## D-222 Bulk upload (lane L3)

Shared details with per file overrides; "publish later" means publish when ready with an optional not before time and never bypasses the caption gate. Options: schedule a time (cannot work: nothing is publishable at upload); intent (chosen). Reversible: yes (drop `publish_intent`). Slice 16 (publish later) is not built in this lane; the upload form has no publish choice yet.

## D-223 Captions on and off (lane L3)

Per video tri state, site default (Super admin), Admin changes it with a reason for Off, Off satisfies the publish gate, Off hides tracks and the CC button, admin can still process captions, the profile's saved choice is untouched. Options: a viewer only toggle (exists already); a per video flag only; flag plus site default (chosen, from the audit's resolved option). Note: approved VTT files live on the public media path, so switching off stops them being offered but does not revoke a URL someone already has; captions are not secret. Reversible: yes.

## D-224 Doc and code mismatches fixed in docs, not code: encoding retry is editor level; Delete forever is admin level. (lane L3)



## D-225 Vietnamese subsets for four fonts, Inter fallback for DM Sans and Poppins (lane L8, DEC-L8-08)
- Decision: Inter, Lora, Nunito and Space Grotesk ship a vietnamese subset (not preloaded) that holds the precomposed Yoruba and Igbo vowels. DM Sans and Poppins have no vietnamese subset upstream, so their stacks end in the Inter latin-ext and vietnamese faces. `selectFonts` takes a language and uses Inter headings for yo, ig and ha (R23, D-169). A committed coverage manifest and hash check keep the glyph claims true.
- Options: latin only, latin plus ext, drop DM Sans and Poppins, fall back to Inter for the missing letters.
- Why: it is the only way to render the letters in the brand fonts that have the subset, and the fallback costs about 95 KB only when a glyph needs it.
- Reversible: yes. The layout still passes no language, so the language rule waits for the languages lane to wire it.

## D-226 Light default stays, Night preset is a Could (lane L8, DEC-L8-01)
- Decision: Keep the light off-white default. A Night preset is a later Could story (M47-S16), gated by the contrast gate.
- Options: Dark default, light default, light with a Night preset.
- Why: The owner brief and the design system are light first, and every colour is a token so a preset is cheap.
- Reversible: yes.

## D-227 Button sizes 2, 2.5 and 3 rem with a 44px hit area (lane L8, DEC-L8-02)
- Decision: Visual heights come from size tokens. A before element keeps the tap area at 44px on fine pointers and coarse pointers get a 44px minimum.
- Options: 32px buttons as is, 44 only, tokens plus a hit area.
- Why: It meets the audit sizes and the 44px rule together.
- Reversible: yes.

## D-228 Nav heights stay 3.5 and 4.25 rem, solid after a 40px sentinel (lane L8, DEC-L8-04)
- Decision: Heights are unchanged. A 40px sentinel and IntersectionObserver replace the scroll listener, with a solid fallback.
- Options: Audit heights of 3 and 4 rem, keep.
- Why: The 44px controls need the height, and the threshold follows the audit.
- Reversible: yes.

## D-229 Type scale follows the docs, hero is a clamp (lane L8, DEC-L8-05)
- Decision: Below 960 h1 to lead are 28, 24, 20, 18 and 17. From 960 they are 40, 32, 24, 20 and 18. The hero is clamp(2rem, 5vw, 3.5rem).
- Options: Keep single values, adopt the docs, adopt only the audit values.
- Why: Mobile first, 360px baseline, and tokens are reassigned instead of component overrides.
- Reversible: yes.

## D-230 Rows use proximity scroll snap and a hover card that fits the gutter (lane L8, DEC-L8-06 and DEC-L8-07)
- Decision: Rows keep scroll-snap proximity. The hover card scales the thumbnail, origin left on the first item and right on the last, and is off below a 600px row where the growth would exceed the gutter.
- Options: Mandatory snap, measured last visible origin, CSS only.
- Why: Mandatory snap traps short rows and fights the scale. CSS only avoids layout measuring on hover.
- Reversible: yes.

## D-231 Rails widen to 120rem at 1920, text keeps 90rem (lane L8, DEC-L8-11)
- Decision: --content-max is 120rem from 1920 and --prose-max stays 90rem for text pages.
- Options: One cap.
- Why: Six columns at 1440 would be too small.
- Reversible: yes.

## D-232 Nav fade is linear with the colour flip at 35 percent, scrim holds 70 percent, seek rail follows L4 (lane L8, DEC-L8-13 to DEC-L8-16)
- Decision: The nav fade is linear and text, underline and ring flip as one step at 35 percent (70 ms in, 130 ms out). The nav scrim holds 0.85 to 70 percent of the bar. The seek rail and buffer are L4's #6A6E78 and #9CA0AA, with a separate card progress rail token.
- Options: Eased fade, linear scrim, plan buffer value #9A9FAB.
- Why: Linear keeps the worst frame at 3.98:1, the hold keeps white text above 4.5:1, and L4 landed the rail values first with tests.
- Reversible: yes.

## D-233 Guests land on Home and the library is split by context (lane L1)
- Decision: A signed out visitor sees Home at `/` (the sign in card landing stays only when `features.guest_play` is off), and Browse, category and Search render for guests through `getViewerOrGuest`. `getLibrary()` is wrapped by `forGuests`, which answers a guest context from `guestLibrary` (empty reads, refused writes) and sends every other context to the real library, so a guest render can never reach an account table. The guest header over the hero uses the `--color-hero-chip-bg` token (the 0.6 dark backing from the design review) with a white edge. Hero Play already goes to `/watch/<id>` for videos. Slice 3 had created `guestLibrary` but never wired it; this slice does.
- Options: branch inside every page, or one dispatch at the data layer.
- Why: One place to fail closed, and pages stay the same for both kinds of viewer.
- Reversible: yes.

## D-234 Kids mode for visitors is a device cookie that reaches every guest path (lane L1)
- Decision: The Kids mode switch of a visitor sets the unsigned cookie `__Host-ad_gaud` (`k` or `g`) through `setGuestAudienceAction`, which takes a boolean and needs no session. The device choice, else `features.guest_audience`, now decides: the page render audience, the guest playback session (`kids` claim on the token and Kids safe keys), the guest watch lookup, and analytics (a Kids mode guest stores no identity, same as a kids profile). Selecting a kids profile sets the hint to kids and leaving it with the password sets it to general, so a device left on a kids profile stays safe after sign out. A kids guest opening an adult video sees "This video is not in Kids mode" with Browse and Turn off Kids mode (two actions, because turning it off is the way forward and Browse the safe way out; R39 normally allows one). The Kids header shows only the logo mark, so the way to turn Kids mode off in a kids session is a quiet button above the footer. `client.json` gains `guestAudience` and `guestPlay`, and the admin Features screen gets the guest play switch and the guest segment minutes. The admin audience select is not built: the setting is reachable through `client.json` and the settings API.
- Options: sign the cookie (it would stop a child changing it no more than the toggle does), or keep it plain as a convenience.
- Why: R17 says anyone using the device can turn it off, so a lock would promise something the design does not give. Unsigned keeps the page cacheable per cookie value and removes a secret from the page render path.
- Reversible: yes.

## D-235 A save a visitor asked for is remembered on the device for 30 minutes (lane L1)
- Decision: When a visitor follows Sign in or Create account from the Sign in to save dialog, the wish (`my-list` or `like` with an item key) is written to `ad:guest:intent:v1` in localStorage with a timestamp. It lives 30 minutes, holds one wish (the latest), and is validated on read (version, kind, item key shape, age); anything else is deleted and ignored. After sign in, `GuestIntentApplier` (inside the signed in chrome) takes a `my-list` intent once, adds the item through the normal My List path (so the offline queue still applies) and says "Added to My List". A `like` intent is left in place for the likes owner (L5). Not now stores nothing. `/my-list` for a guest shows an explainer with Sign in, Create account and Browse, and no data is read; in Kids mode it shows the grown-up note with no account links (R17). Every return path stays a same origin path (`safeNext`), pinned by a test.
- Options: carry the item in the sign in URL, or keep it in the device.
- Why: The URL is logged and shared, and a longer `next` is one more thing to validate. The device copy is private, expires, and cannot be used to add anything the visitor did not ask for, because only a validated key from this app is accepted.
- Reversible: yes.

## D-236 Guest Continue learning joins device progress to titles by id (lane L1)
- Decision: The row is built on the device. `GuestContinueRow` reads `ad:guest:progress:v1`, keeps started and unfinished videos (5 seconds or more, newest first, at most 20), asks `GET /api/titles/batch?ids=` for the cards, and joins them in the browser. The server sees only a list of ids and never positions, and a video that is unpublished, hidden or not in the device audience simply drops out. It reuses `ContinueRow` (new `title` prop, default unchanged) with device backed `remove` and `restore`: removing deletes the entry, Undo writes it back with its old timestamp. The heading is the message key `guest.continue.title` ("Continue learning", R14). A failed lookup shows nothing. The series page uses `GuestEpisodeProgress`, which marks finished and partly watched episodes and moves Up next to the first unfinished one. `toThumb` moved to `lib/media/to-thumb.ts` so client code can use it without the server mappers (re-exported, no behaviour change).
- Options: send positions to the server for a joined response, or ids only.
- Why: Positions are the private part. Ids only keeps the device the owner of what was watched and keeps the batch route cacheable and simple.
- Reversible: yes.

## D-237 History import is a signed in, limited, account-wins write (lane L1)
- Decision: `POST /api/progress/import` (`importGuestProgress` in `@ad/viewer`) takes `{ profileId, items: [{ videoId, positionMs, finished, updatedAt }] }`, at most 100, and is a normal personal route: session required (401 for guests), same origin required, the profile must belong to the account (404 otherwise), and it spends the existing `progress` bucket. The server takes duration from the video, drops anything that is not a published video in the profile's audience, drops positions under the start threshold, clamps positions, and replaces a future timestamp with now. A video the profile already has progress for is never overwritten (the account wins), done with `ON CONFLICT DO NOTHING`. The prompt (`ImportPrompt`) shows after sign in when the device holds history, once per visit, never for a kids profile, and the device copy is removed only after the server accepted it; Not now keeps it. The one write is inside `withAccount`, so row level security still applies.
- Options: merge by newest timestamp, or let existing account progress win.
- Why: A newest-wins merge would let a stale device overwrite a place the person reached on another device. Account wins is the safe default and loses nothing the device still holds.
- Reversible: yes.

## D-238 Guest sessions escalate to a Turnstile check after repeated refusals from one network (lane L1)
- Decision: Three layers protect guest playback. First the existing limits: 20 sessions a minute per guest id and 120 a minute per network (`PLAY_POLICIES.sessionGuest`, `sessionGuestIp`), segment links for guests that last 20 minutes (setting `limits.guest_segment_minutes`, 5 to 120). Second, an escalation: each 403 or 429 on a playback route, and each rate limited guest session, spends one token of a `guest-challenge-ip` bucket (capacity 3, refilling over 10 minutes). With the bucket empty, `POST /api/play/{id}/session` for a visitor without an account answers 403 `challenge_required` before any cookie is minted, until a valid Turnstile token arrives in the `x-turnstile-token` header. A plain 401 (an expired token) never counts, so a long pause does not trip it. Third, the Cloudflare rule in DEPLOYMENT.md as the outer wall. The escalation only exists when the Turnstile keys are set. It fails open if the limiter store is down, because the session limits already fail closed. The bucket subject is a keyed hash of the truncated network (IPv4 /24, IPv6 /48), so no raw address is stored; the older per address playback buckets keep their existing subject. In the player, `createHttpSessionProvider` takes `solveChallenge`, retries once with the token, and otherwise throws `SessionError('challenge')`; the watch page shows `GuestChallenge` (one action, Cancel). Signed in viewers are never challenged. New shared error: `ChallengeRequired`.
- Options: challenge every guest, challenge never, or escalate on abuse.
- Why: Most visitors never see a check, and a person behind a shared mobile network is only asked after their network has been refused several times.
- Reversible: yes.

## D-239 Search engines read the public catalog, and guest limits never store a raw address (lane L1)
- Decision: `robots.txt` (`app/robots.ts`) allows the public catalog (Home, Browse, title and series pages) and disallows `/api/`, `/admin`, `/account`, `/profiles`, `/settings`, `/my-list`, `/watch/`, `/search`, `/sign-in`, `/sign-up` and `/verify-email`. Search and My List also carry `noindex`, because a disallow alone does not stop indexing. A `Sitemap:` line is added as soon as `app/sitemap.ts` exists (lane L6) and `APP_ORIGIN` is set; a test pins it. Guest session limits and the challenge counter key on `networkSubject(secret, ip, label)`, an HMAC of the truncated network (IPv4 /24, IPv6 /48) per purpose, through `PlaybackHttpDeps.guestSubject`, so those tables hold no raw address (SECURITY.md section 11). The older key route bucket (`play-key-ip`) keeps its address subject, as before this lane. The Turnstile check is not offered to a visitor in Kids mode, since Kids playback pages load no third party script (SECURITY.md section 12); they get the wait message. The Playwright journeys for guests are written and gated on `E2E_REAL`, and were not run in the build session.
- Options: leave the catalog closed to crawlers, or open it. Hash the address, or keep it.
- Why: Open playback is the point of the lane, and shared links should preview and rank. Hashing costs nothing and matches the privacy table.
- Reversible: yes.

## D-240 Caption edge is a saved choice, and Edge None on a clear background is drawn as Shadow (lane L4, L4-D19)
- Decision: caption appearance gains an Edge (none, shadow, outline), default shadow, saved in the profile `playbackPrefs` as `captionEdge` (no migration) and on the device for guests. When the background is None and the edge is None, the player draws Shadow and the panel says so. The saved value is not changed, so choosing a background again brings Edge None back.
- Options: warn only, or correct the drawing.
- Why: white text on a bright frame with no edge is unreadable, and a warning still leaves it unreadable.
- Reversible: yes.

## D-241 Autoplay countdown is a site setting, Still watching follows three unattended autoplays, and the next page is only warmed outside Data saver (lane L4, L4-D4)
- Decision: the countdown length is the site setting `playback.countdown_seconds` (whole seconds, 5 to 10, default 5), named like the other `playback.*` keys instead of the plan's `playerCountdownSeconds`, and the controller corrects any other value into that range. After three autoplays in a row with no pointer, touch or key input (count kept in `sessionStorage` under `ad:autoplay-streak`) the end screen shows "Still watching?" with Keep watching and Stop and does not count down. The Next tile starts at the credits marker when one exists, otherwise in the last 15 seconds. The host is asked to warm the next watch page once when the tile shows, and never with Data saver on.
- Options: a free text or per profile countdown, always counting down, prefetching with Data saver on.
- Why: one admin number is enough, an unattended screen should stop spending a viewer's data, and Data saver must mean nothing is fetched early.
- Reversible: yes.

## D-242 One Settings button holds speed, quality, autoplay, captions and shortcuts, and a kids profile cannot flip autoplay (lane L4, L4-07)
- Decision: the separate Speed and Quality buttons are replaced by one Settings button on every screen size. Its rows show their current value and open a submenu for Speed and Quality (Audio appears only with more than one track). Autoplay next is a switch that saves through the same preference as the account page and changes the end screen at once. Caption appearance and, on desktop only, Keyboard shortcuts open from rows. On a kids profile the switch is shown but locked with "Set by a grown up", matching the account page lock.
- Options: keep the loose buttons and add a gear, or one panel for everything.
- Why: one predictable place, the same on phone and desktop, and the shortcuts dialog gets a visible entry point instead of only the question mark key.
- Reversible: yes.

## D-243 Slow connection help is one sentence and one action, and every player error shows one action that takes focus (lane L4, R39)
- Decision: on a locked quality a stall of 8 seconds shows "Slow connection. Try Auto or a lower quality" with Open quality. Two stalls within 60 seconds on Auto with Data saver off show, once per video, "Videos load slowly right now. Turn on Data saver to use less data" with Turn on and Dismiss. Each player error shows one title, one sentence and one action, and the action takes focus. Cannot play loses its Report link and shows `Reference: AD-7K4Q` as small text, connection lost shows it from the third retry. A Downlink under 1.5 Mbps counts as low data like Save-Data and 2g or 3g. A Data saver choice that cannot be saved shows a toast that stays until dismissed.
- Options: keep the Report link beside Try again, show the reference inside the sentence, hint on every stall.
- Why: R39 allows one action per error, the reference is for support and should not read as part of the message, and a hint on every stall would become noise.
- Reversible: yes.

## D-244 AirPlay is a super tier site flag that is off by default, and the native engine switch stays until a device spike passes (lane L4, R16)
- Decision: `features.airplay` (default off, not public) shows the AirPlay button, and only on Safari when it reports a device. Starting AirPlay builds a native engine first and keeps the current one if that fails. Picture in picture was reworked to cover the standard API and the iOS presentation mode. Chromecast is not built.
- Options: always show the button on Safari, ship with no flag and no spike, build Chromecast now.
- Why: R16 says AirPlay stays hidden until it works on a real iPhone and a Mac with an Apple TV, and the spike notes in docs/spikes/airplay.md say what to check and when to drop the engine switch.
- Reversible: yes.

## D-245 Audio track switching is a documented stub until a second spoken language exists (lane L4)
- Decision: the Audio row in the Settings menu stays built but hidden (it shows only with more than one track). No engine or controller audio code is added now.
- Options: build track events and `selectAudio` now, remove the Audio row.
- Why: there is no second spoken language at launch, so the code would be untested against real streams. The row is already in place, so the later work is small.
- Reversible: yes.

## D-246 Locale model and selection without a URL prefix (lane L7)
- Decision: Locales are the codes en, yo, ig, ha and pcm. The locale comes from ?lang=, then profile, account, the ad_locale cookie, Accept-Language, then the site default. No URL prefix.
- Options: URL prefix per locale, cookie and header only.
- Why: Guests are first class and there is no SEO work yet, so a prefix would touch every route for no viewer benefit. Reversible later with redirects from the cookie.
- Reversible: yes

## D-247 Allow labelled sponsor slots and donations despite earlier non-goals (lane L9, L9-D01)
- Decision: Allow, off by default: the client may want funding, and it costs nothing when off
- Options: Keep platform ad free; allow optional off by default.
- Why: see the recommended option above and `docs/plan/v2/L9-monetization.md` section 11.
- Reversible: yes, flags and docs.

## D-248 Payment provider (lane L9, L9-D02)
- Decision: Paystack first: Nigeria first, NGN settlement, hosted checkout, bank transfer and USSD for donors without cards. Flutterwave as a Could behind the same interface
- Options: Paystack; Flutterwave; Stripe.
- Why: see the recommended option above and `docs/plan/v2/L9-monetization.md` section 11.
- Reversible: yes, provider interface.

## D-249 Checkout style (lane L9, L9-D03)
- Decision: Hosted redirect: no third-party script, no card data on our servers, no CSP change
- Options: Popup script; inline fields; hosted redirect.
- Why: see the recommended option above and `docs/plan/v2/L9-monetization.md` section 11.
- Reversible: yes.

## D-250 Sponsor format (lane L9, L9-D04)
- Decision: Still image or text cards only, one link, labelled
- Options: Video ads; image cards; text only.
- Why: see the recommended option above and `docs/plan/v2/L9-monetization.md` section 11.
- Reversible: yes.

## D-251 Click tracking (lane L9, L9-D05)
- Decision: First party redirect at `/s/{id}`, destination from the database
- Options: Third-party tracker; client only fetch; first party redirect.
- Why: see the recommended option above and `docs/plan/v2/L9-monetization.md` section 11.
- Reversible: yes.

## D-252 Frequency cap storage (lane L9, L9-D06)
- Decision: First party functional cookie `ad_spc` read on the server: works for guests, no identifier, no shift
- Options: Account based; server per IP; first party cookie.
- Why: see the recommended option above and `docs/plan/v2/L9-monetization.md` section 11.
- Reversible: yes.

## D-253 Reach metric (lane L9, L9-D07)
- Decision: Daily distinct count only, labelled "daily reach", counts stored not hashes
- Options: None; hashed unique per day; exact uniques.
- Why: see the recommended option above and `docs/plan/v2/L9-monetization.md` section 11.
- Reversible: yes.

## D-254 Kids protection (lane L9, L9-D08)
- Decision: Server fail closed in selection, click, impression, checkout and cookie code, plus a kids matrix test
- Options: Filter in UI only; server fail closed.
- Why: see the recommended option above and `docs/plan/v2/L9-monetization.md` section 11.
- Reversible: no (safety).

## D-255 Before-video card (lane L9, L9-D09)
- Decision: Skippable at once, ready media loads in parallel, never on Data saver or resume, off by default, after-video card preferred
- Options: Forced wait; skippable at once; not offered.
- Why: see the recommended option above and `docs/plan/v2/L9-monetization.md` section 11.
- Reversible: yes.

## D-256 Sponsor status (lane L9, L9-D10)
- Decision: Derived from dates at read time, stored only draft, paused, archived
- Options: Stored status with cron; derived from dates.
- Why: see the recommended option above and `docs/plan/v2/L9-monetization.md` section 11.
- Reversible: yes.

## D-257 Money type (lane L9, L9-D11)
- Decision: Integer minor units, per currency
- Options: float; decimal; integer minor units.
- Why: see the recommended option above and `docs/plan/v2/L9-monetization.md` section 11.
- Reversible: no.

## D-258 Webhook trust (lane L9, L9-D12)
- Decision: Signature plus API verify plus amount and currency check, idempotent by event key
- Options: Trust payload; signature only; signature plus API verify.
- Why: see the recommended option above and `docs/plan/v2/L9-monetization.md` section 11.
- Reversible: yes.

## D-259 Donor identity (lane L9, L9-D13)
- Decision: Email only, guests allowed, account link optional
- Options: Account required; email only.
- Why: see the recommended option above and `docs/plan/v2/L9-monetization.md` section 11.
- Reversible: yes.

## D-260 Donor data at rest (lane L9, L9-D14)
- Decision: Encrypted email, name, message and raw event payloads with the existing field key, HMAC hash for lookups
- Options: Plain; encrypted fields.
- Why: see the recommended option above and `docs/plan/v2/L9-monetization.md` section 11.
- Reversible: no.

## D-261 Small gifts (lane L9, L9-D15)
- Decision: Minimum NGN 200 configurable, because flat fees dominate tiny gifts [VERIFY]
- Options: No minimum; minimum NGN 200.
- Why: see the recommended option above and `docs/plan/v2/L9-monetization.md` section 11.
- Reversible: yes.

## D-262 Donor wall (lane L9, L9-D16)
- Decision: None, privacy and kids concerns. Transparency page shows use of funds only
- Options: Public names; none.
- Why: see the recommended option above and `docs/plan/v2/L9-monetization.md` section 11.
- Reversible: yes.

## D-263 Sponsor and donation roles (lane L9, L9-D17)
- Decision: Editor manages sponsor drafts, admin activates sponsors and alone sees donations and settings
- Options: Editor can see all; split.
- Why: see the recommended option above and `docs/plan/v2/L9-monetization.md` section 11.
- Reversible: yes.

## D-264 Receipt wording (lane L9, L9-D18)
- Decision: Acknowledgement only until counsel confirms
- Options: Tax receipt; acknowledgement.
- Why: see the recommended option above and `docs/plan/v2/L9-monetization.md` section 11.
- Reversible: yes.

## D-265 Reporting artefact (lane L9, L9-D19)
- Decision: CSV and browser printable summary, no portal
- Options: Sponsor portal; CSV and print page.
- Why: see the recommended option above and `docs/plan/v2/L9-monetization.md` section 11.
- Reversible: yes.

## D-266 Test mode safety (lane L9, L9-D20)
- Decision: Mode derived from key prefix, live key refused outside production, rows tagged with mode
- Options: Setting; key prefix.
- Why: see the recommended option above and `docs/plan/v2/L9-monetization.md` section 11.
- Reversible: yes.

## D-267 Phone sponsor card shows an arrow, the whole card is the link (lane L9, L9-D21)
- Decision: below 960 px the card shows a 20 px chevron (aria-hidden) and is one anchor whose accessible name is "Sponsored by NAME: HEADLINE. CTA_LABEL". From 960 px the text button from cta_label shows. No nested interactive element in either.
- Options: a text button inside the compact card, a chevron arrow with the whole card as the link.
- Why: a text button takes about 90 px of the 190 px text column at 360 px, drops the headline to 3 lines and needs a taller box that pushes the first row down. The arrow keeps 112 px and the target is the whole card.
- Reversible: yes. Review after a trial on low end Android phones in Lagos.
## D-268 Sitemap is served by route handlers, 5,000 urls per file, real change dates only (lane L6)
- Decision: `/sitemap.xml` is a route handler. One urlset while everything fits in 5,000 urls, otherwise an index that points at `/sitemaps/<n>.xml`. No changefreq or priority. `lastmod` is the real change date (a series takes the newest of itself and its episodes). A failed catalog read answers 503 with Retry-After 300, never an empty 200. Responses carry `s-maxage=3600`, so an unpublished title leaves the sitemap within an hour.
- Options: the `sitemap.ts` metadata file with `generateSitemaps`, route handlers.
- Why: only a handler can set the 503 status that story M45-S01 requires, and the plain `/sitemap.xml` address stays stable for `robots.txt`. The pure builder is shared, so moving to the file convention later is small.
- Reversible: yes.

## D-269 Kids only titles stay out of search engines (lane L6, R26)
- Decision: a video is kids only when its suitability is Kids, or when an older row has no suitability and the kids flag is set (the derivation the admin screen already uses). Kids only videos are left out of the sitemap, and a series is listed only when it has at least one live episode that is not kids only. Titles for everyone are indexed. Page level `noindex` follows in the metadata slice.
- Options: index everything, index general titles only.
- Why: kids content is not marketed through search, and parents expect it. Titles marked for everyone still reach a wide audience.
- Reversible: yes.


## D-270 Catalog layers and validation rules (lane L7)
- Decision: Effective text is approved DB row, then committed baseline JSON per locale, then English. Translations are validated for placeholders, plural categories the locale uses, no HTML, no en or em dashes, NFC, and a 2.5 times length warning. Baselines ship empty and the Yoruba, Igbo, Hausa and Pidgin samples stay drafts until a native speaker approves.
- Options: DB only, JSON only, per key merge.
- Why: Git stays the long term record while volunteers edit without deploys; drafts never reach viewers.
- Reversible: yes

## D-271 Viewer two step verification is optional TOTP on the shared MFA core, with a signed pending note instead of a pending session and an Admin only reset (lane L10, D-L10-01, D-L10-02)
- Decision: viewers can turn on an authenticator app (TOTP) with ten single use recovery codes. The mechanics live in `packages/auth/src/mfa-core.ts`, shared with staff. After a correct password `signIn` returns `mfa_required` with a signed ten minute note (`mfa-pending.ts`), not a session, so nothing opens account routes until the code is accepted. Wrong codes use the existing `mfa:<accountId>` lockout. Turning it off needs the password and a current code or recovery code and ends the other sessions. A lost phone and codes have no self service bypass: an Admin resets it with a reason, which is audited and mailed. Staff stay on their mandatory flow and cannot use the viewer service. The switch `viewerMfaEnabled` (env `VIEWER_MFA_ENABLED`, default on) turns the challenge off in an emergency.
- Options: SMS codes (cost, SIM swap), email codes (same inbox as the password reset), a `pending_mfa` viewer session (needs a new session column because a viewer pending session looks like a normal one), TOTP with a signed note (chosen).
- Why: staff TOTP, replay guard and lockout already exist, a note without a session cannot be mistaken for a signed in viewer, and email is a notice only so two step never depends on mail delivery.
- Reversible: yes (the flag, or drop the service).

## D-272 Maturity is a five step rank kept in step with kids_safe by database triggers (lane L5, M44, R20)
- Decision: `videos.maturity_rank`, `series.maturity_rank` (0 to 4, null until rated) and `profiles.max_maturity_rank` (default 4) are added in migration 0038. Triggers keep `kids_safe` equal to `rank = 0` whenever a rank is set, and force a kids profile limit to 0 whatever a writer sends. The visibility predicate gets an optional `Audience.maxRank`. A row with no rank falls back to its legacy `kids_safe` flag (rank 0) and otherwise counts as 4, so a limited audience never sees an unrated title by accident.
- Options: replace `kids_safe` with the rank, a check constraint only for kids profiles, treat every unrated row as 4.
- Why: every existing query, index and test keeps working because `kids_safe` stays. A trigger for the kids limit cannot be bypassed by a legacy writer, where a check would break them. The legacy fallback keeps kids safe rows visible to kids until slice 2 moves every writer to ranks.
- Reversible: yes. Additive columns, a code revert leaves valid data.

## D-273 Maturity labels are a setting and nothing compares labels (lane L5, R20)
- Decision: default labels G, PG, 12, 15, 18 are stored in `maturity.labels` as five comma separated labels of 1 to 4 characters, validated by `parseMaturityLabels`. Guests may see up to rank 2 by default through `maturity.guestMaxRank`. Code only ever compares ranks.
- Options: fixed labels, labels per language.
- Why: the client may prefer plain words, and a Nigerian classification name is only a default.
## D-274 Hero auto rotate is on by default at 10 seconds, driven by two settings and no hardcoded time (lane L2, R12, L2-D01 and L2-D02)
- Decision: `features.autoplay_hero` defaults to true and `home.hero_interval_seconds` (5 to 20, default 10) sets the time. `home.hero_max_loops` (0 to 5, default 2) stops rotation after that many rounds, 0 means never. The Home tab of Site settings edits them.
- Options: off at 7 seconds (old docs), on at 8 seconds (old code), on at 10 seconds with settings.
- Why: the owner asked for about 10 seconds, the pause control and the reduced motion and Data saver rules cover the data and motion risks, and one source removes the disagreement between docs, registry and code.
- Reversible: yes, by the settings. Sites that already saved `features.autoplay_hero` keep their value.

## D-275 Home keeps its server rules in ViewerRules and its labels in settings (lane L2, L2-D13)
- Decision: `heroFallbackCount` 5, `popularMinItems` 4, `trendingWindowDays` 7, `autoCategoryMinItems` 4, `autoCategoryMax` 6 and `allSeriesMinItems` 2 are `ViewerRules` defaults. `home.view_all_label` ("View all") and `home.continue_title` ("Continue learning") are public text settings.
- Options: all of it as settings, all of it as constants.
- Why: counts and thresholds protect Home from looking empty and rarely change, so they stay rules with a context override. Words the client may want to change are settings.
## D-276 Sponsors store an explicit active status, and contact and notes live in a private table (lane L9, L9-D22)
- Decision: the stored sponsor status is draft, active, paused or archived. A sponsor needs a stored state that means "approved to run", so `active` is added to the plan list, and live, scheduled and ended stay derived from the dates. Contact and internal notes sit in `sponsor_private` (staff only) instead of columns on `sponsors`, because live sponsor rows are readable by anonymous visitors.
- Options: keep the plan columns on `sponsors` and hide them with column grants, a separate private table.
- Why: column grants cannot depend on the actor role, so a staff only table with its own policy is the simplest way to make leaks impossible.
- Reversible: yes.

## D-277 Caption track publish flag and missing key function (lane L7)
- Decision: caption_tracks.published defaults to true so every existing approved track stays visible. ui_translations is readable by anyone for approved rows only and writable by staff through row level security. Viewer requests record missing keys only through the SECURITY DEFINER function record_missing_key, capped at 10,000 keys per locale.
- Options: Open insert grant on ui_missing_keys, a worker only writer.
- Why: A viewer with no account must be able to record a hit, and must never read drafts or the report.
- Reversible: yes

## D-278 Structured data never carries a rating and drops itself when it cannot be built (lane L6)
- Decision: Title pages emit VideoObject (no contentUrl, embedUrl is the title page) and a breadcrumb, series pages emit TVSeries with at most 50 episodes, Home emits WebSite with a search action plus Organization, category pages emit a breadcrumb. No aggregateRating or review markup is ever written. A block that lacks name, thumbnail or upload date is skipped and the page renders without it. Kids only titles carry no structured data and ask not to be indexed.
- Options: Emit ratings from likes, omit structured data, current choice
- Why: No ratings exist and invented ones break search engine policy. The media url is signed and short lived, so it is never published.
- Reversible: Ratings: no, it would risk a policy penalty. The rest: yes

## D-279 Locale hint headers and profile language validation (lane L7)
- Decision: The proxy handles ?lang= (sets ad_locale, keeps the path) and forwards x-ad-locale-hint and x-ad-locale-source. getLocale resolves query, profile, cookie, Accept-Language, site default. Profile language must be a supported code. Account level locale is not read yet because the session carries only the profile.
- Options: Read accounts.locale in the session now.
- Why: Keeps the session type unchanged for other lanes. The picker writes the profile for signed in viewers and the cookie for everyone.
- Reversible: yes

## D-280 Share images are generated from the poster as a 300 KB jpeg with a configurable default (lane L6)
- Decision: A route handler at /og/title/<slug> and /og/series/<slug> draws the poster cropped to 1200 by 630 with the four stop scrim, the title (80 characters at most) and the site name, then writes a jpeg stepped down in quality until it is under 300 KB. The share url carries ?v=<published date> so changed images get a new address. Unpublished titles answer 404. No poster or a failed render redirects to the site default image, then to the bundled placeholder.
- Options: Hand made image per title, generate from the poster, metadata file convention
- Why: WhatsApp drops previews over about 300 KB, and a handler lets us 404 drafts and fall back. Signed urls are never used so old shares keep working.
- Reversible: Yes

## D-281 Admin writers keep accepting suitability but map it onto a rank, publishing needs a rating, raising a profile limit needs the password (lane L5)
- Decision: the legacy `suitability` input maps to a rank (kids and everyone 0, older 3) so older callers keep working. Publishing a video or series is blocked until it has a rank. A profile limit can be lowered freely and raised only with the account password, sharing the kids exit attempt bucket. Playback sessions and key requests re-check the limit.
- Options: remove suitability at once, default new videos to a middle rank, allow raising without a password.
- Why: no title is rated G by accident, a child cannot raise their own limit, and old UI paths keep working until the UI slice replaces them.
- Reversible: yes.

## D-282 The hero clock keeps spent time, waits for the image and the mobile scrim reaches higher than R36 first said (lane L2, R12, R36)
- Decision: one timeout per slide keeps the time already spent while held (hover, focus, hidden tab, Pause), restarts on any manual change, starts when the slide image loads or after 1.5 s, and stops on the first slide after `home.hero_max_loops` rounds. Reduced motion is read live. Pause and the dot fill are not drawn once rotation cannot run. The mobile scrim holds 0.85 to 72 percent, 0.7 at 82 and 0 at 96, and the title is clamped to two lines.
- Options: keep the 50, 65, 80 stops and shrink the text, restart the full interval after a hold.
- Why: Chromium measurements in packages/ui/test/hero-text-zone.test.ts showed a two line title on a 360 wide phone sits at about 77 percent of the hero height, so the earlier stops left it at alpha 0.08 and contrast 1.2 over white art. The test now guards 4.5 to 1 and alpha above 0.57 at 360, 390 and 1360.
- Reversible: yes, by the scrim tokens.

## D-283 Discovery settings: social image is a link for now, robots follow the indexing switch (M45-S05) (lane L6)
- Decision: Site description, social image link, share text, indexing, share channels (WhatsApp, Facebook and X on, Email off, Copy link always on) and the storage notice text, switch and version are registry settings in a Discovery tab. The social image is an https link or a site path, not an upload, because the brand image uploader has no social purpose yet. Description falls back to the tagline then a neutral line. robots.txt and a noindex tag close the whole site when indexing is off or the environment is not production.
- Options: Upload through a new brand image purpose, a link
- Why: A link ships now and works with any hosted image. An upload is a small follow up on LogoUploader. Staging must never be indexed even when someone forgets the switch.
- Reversible: Yes

## D-284 Ratings are per profile, three levels, never for kids, and an episode is rated through its series (lane L5, M44)
- Decision: `title_ratings` stores -1, 1 and 2 per profile and title with owner RLS, a database trigger that refuses kids profiles, and a SECURITY DEFINER aggregate function that gives the worker counts without profile ids. Rating writes spend a new `engage` bucket (60 per minute per account). Episode ids are refused with a 422.
- Options: per account ratings, allow kids to rate, give the worker read access to the table.
- Why: SECURITY.md section 12 forbids personalisation signals for kids, and the worker only needs totals.
- Reversible: yes.

## D-285 Share menu: native share on phones, WhatsApp first on desktop, tag for first party counts only (M45-S06) (lane L6)
- Decision: Share opens the system sheet where navigator.share exists. Elsewhere a dialog lists Copy link, then the channels the admin enabled (default WhatsApp, Facebook, X, Email off per R26). Links carry ?s=wa|fb|x|em|cp|nt on the shared copy only, the canonical never has it. Kids profiles and Kids mode get no Share. External links open in a new tab and say so. Channel events for analytics wait for the analytics posture guard.
- Options: Always a menu, native only, native with menu fallback
- Why: People on phones expect their own share sheet, and desktop visitors in Nigeria mostly share through WhatsApp.
- Reversible: Yes

## D-286 Search stays in Postgres with a word list for corrections, synonym groups and an anonymous misses table (M45-S07 to S09) (lane L6)
- Decision: No external search engine. A search_terms word list (live title and category words, trigram index) corrects long words that are not known words. Words of four characters or fewer match exactly and the old fuzzy title match is off unless every word has five characters. A raw search with no results, or with as many results for the corrected spelling, shows the corrected results with Showing results for. Synonym groups live in search_synonyms with a neutral seed, expand at most 8 words per query and rank below exact matches. search_misses stores only the normalised words, a count and a date, and is pruned after 90 days. Publishing and unpublishing refresh the word list in a savepoint.
- Options: Meilisearch or Typesense, Postgres
- Why: A free tier host with one datastore and a catalog under 10,000 titles. The kids rule holds because a correction is only used when the audience filtered search finds results.
- Reversible: Yes, behind searchTitles

## D-287 Trending is an hourly stored snapshot filtered at read time, and thin data hides the row instead of faking it (lane L5, M44)
- Decision: `title_scores` holds the top 60 trending and popular titles, refreshed hourly from raw view events (7 Lagos days, decay 0.8, one viewer at most 3 plays per title per day, completions add one, a series scores as its episodes). Each read filters for visibility, kids and the maturity limit. Trending needs 5 qualifying titles and 50 plays, Top 10 needs 10 titles, Popular needs 3 titles with 5 views, and a snapshot older than 3 hours counts as empty.
- Options: compute per request, always fill the row with newest titles, a per profile snapshot.
- Why: honest rows on a new site, no per profile data in the snapshot, and one cheap read per audience.
## D-288 Home sections carry a slug, a View all setting and a minimum, and there are two automatic row kinds (lane L2, L2-D07, L2-D09)
- Decision: migrations 0042 and 0043 add the row kinds `each_category` and `all_series`, and on `rows` a `slug`, `view_all_mode` (auto, custom, none), `view_all_url`, `min_items` (1 to 20), plus hero text columns on `row_items`. A custom link is a path on this site or an https link of at most 300 characters. Each category rows are expanded at read time from the visible categories with enough live titles, skipping categories that have their own row, up to `autoCategoryMax`.
- Options: seed one row per category at apply time, query parameters on /browse.
- Why: seeded rows go stale as content arrives, and a read time expansion keeps Home complete without admin work. The label and the target are separate so an admin can point a row anywhere safe.
- Reversible: yes, additive columns.

## D-289 Trending hides under four titles with views and never copies New (lane L2, L2-D10)
- Decision: a section with fewer live titles than `min_items` is hidden. Trending counts views over `trendingWindowDays` (7) and has a default minimum of 4. The old fallback to the newest titles is not used on Home.
- Options: fall back to New, keep a one title Trending row.
- Why: a Trending row that repeats New looks broken, and a row of one title is not a trend.
- Reversible: yes, by the row minimum or the rule.

## D-290 Category slugs cannot be new, trending, series or row (lane L2, L2-D08)
- Decision: a check on `categories.slug` refuses the four words the /browse list pages own, and migration 0043 renames any existing category that has one by adding -videos.
- Options: put list pages under /lists, use query parameters.
- Why: static segments under /browse keep one mental model, and a reserved word list stops a category from hiding a list page.
- Reversible: not trivially once the list pages are indexed. Moving them needs redirects.

## D-291 The fixture admin and the real admin keep separate rule copies with a parity test (lane L2)
- Decision: view all, minimum, name and limit rules exist in `apps/web/src/lib/data/admin/home-rules.ts` and `packages/catalog/src/admin/home.ts`. The URL and slug helpers are shared through `@ad/shared/view-all`, and `home-parity.test.ts` checks the validation and default minimums agree.
- Options: delete the fixture admin, move every rule to one package.
- Why: the fixture admin is still needed for UI work without a database, and moving it would touch every admin screen in this lane.
- Reversible: yes.

## D-288 Search misses pruning rides the nightly rollup job (lane L6)
- Decision: pruneMisses runs after the analytics rollup in the same worker handler; a failure is logged and never fails the rollup.
- Options: A separate pg-boss queue; a database cron.
- Why: No new queue or schedule to operate, and rollup success matters more than a prune.
- Reversible: Yes, move to its own queue later.

## D-289 Translation engine ships OFF; no NLLB sidecar (lane L7)
- Decision: Ship only the Translator adapter interface, a Google API key adapter and a test fake. TRANSLATE_PROVIDER defaults to none, API use needs a non zero TRANSLATE_MONTHLY_CHAR_CAP. No NLLB sidecar or apps/translate.
- Options: Self hosted NLLB; Google API only; adapter only
- Why: Ruling R23: NLLB weights are non commercial, so enabling them is not allowed for this product. The adapter keeps the door open.
- Reversible: Yes, a new adapter can be added without schema change

## D-292 Paid translation calls are capped in the worker through translation_usage (lane L7)
- Decision: `withUsageCap` wraps the Google adapter. Before each request it adds the request characters to the month's `translation_usage` row (first of the UTC month, per provider) and refuses with a permanent error if the total would pass TRANSLATE_MONTHLY_CHAR_CAP, or if the cap is 0. The count is added after the provider answers. A paid provider without a usage store behaves as not configured. The fake engine and any future self hosted engine are not counted.
- Options: Count in the job only; count in the adapter wrapper; no cap
- Why: Every call path through the chooser is guarded, including later bulk jobs, and the guard cannot be skipped by a new caller.
- Reversible: Yes

## D-293 Sign in history keeps country only, new devices are told apart by a device cookie hash (lane L10, M49-S13, S14)
- Decision: `login_events` records success, failed, mfa_failed and locked attempts with a two letter country from the trusted proxy header, a short device label and a keyed hash of a random `ad_dev` cookie. No address is stored. A new device email goes out only when that hash was never seen on a success before and the account already had a success, at most once an hour per account. Rows are deleted after 90 days by a daily `auth.login_events_prune` job on the maintenance connection. `sessions` gain `country` and `device_hash` so the devices list shows a country, not an address. Sign out everywhere reuses the existing password confirmed `signOutEverywhere` and lands on Sign in with a notice.
- Options: Store the truncated address, use the user agent as the device key, mail on every sign in.
- Why: The NDPA brief wants the least personal data that still answers "was this me". A user agent changes with every browser update, so it would mail people for nothing. A cookie hash does not.
- Reversible: Yes. The table and cookie can be dropped without touching sessions.

## D-294 After-video sponsor card shows under the player, caps are counted by the browser report (lane L9)
- Decision: The after-video card is drawn under the player when the player reports the ended phase, not inside the player package. The cap cookie (`ad_spc`, `ad_sps`) is written by `POST /api/sponsors/seen`, which the page calls once per viewable impression. Staff clicks on a card go through but are not counted.
- Options: Draw the card inside `@ad/player` beside Up next, draw it in the watch page under the player, count the cap at render time.
- Why: The player package belongs to another lane and its end screen is already crowded. Cookies cannot be set from a server component, and counting at render would count cards nobody saw. A staff member checking a card must not inflate a sponsor report.
- Reversible: Yes. Moving the card into the end screen later only changes where it renders.

## D-295 Card rating chip: fine pointer only, one tab stop that expands, focus shows the card at once (lane L5, M44)
- Decision: the card actions cluster holds My List and a rating chip. The chip shows the current level (Like when unrated) and expands to Not for me, Like and Love on hover or focus within, with the chip first in tab order. It exists for hover and fine pointer only, kids profiles and guests get none, touch rates on the title page. Keyboard focus (`:has(:focus-visible)`) scales the card and shows the peek with no delay. Most liked shows in the peek and is spoken in the link name, never as a count.
- Options: three always visible buttons, a popover menu, hover only.
- Why: the compact chip keeps the 44 px targets without covering the thumbnail, it stays reachable by keyboard, and `:focus-visible` avoids scaling a card after a mouse click.
## D-296 Viewer notices are written only by the worker, one per profile per series or day, and grow instead of repeating (lane L5, M44-S12)
- Decision: the `notices.fanout` job claims newly live videos (`videos.announced_at`, backfilled at migration) in the same transaction that writes the notices, so a crash rolls the claim back. One notice per profile per series per Lagos day, one grouped video notice per profile per day. A later batch the same day raises `item_count`, rewrites the title and marks it unread again. The worker reads followers through SECURITY DEFINER functions and never touches `my_list`, `watch_progress` or `profiles`. Kids profiles are refused by a database trigger.
- Options: a notice per episode, a notice table written by the web app, a cron that scans every profile.
- Why: no spam on a binge release, no duplicates on retry, and the worker role stays narrow.
- Reversible: yes.

## D-297 The storage inventory is built from the real names and durations, and the notice and toast cannot overlap (lane L6, M45)
- Decision: `STORAGE_INVENTORY` lists every cookie, storage key and cache the visitor build sets, each row naming its source file and the text to find there, with durations taken from the same constants the code uses. A test fails on any placeholder, missing source or drifting duration. The notice sits bottom right from 1024 px, spans the width from 600 px, sits above the tab bar below 960 px, uses layer 30 and publishes `--notice-h` for the toast container. A stylesheet geometry test checks the two rectangles never intersect from 360 to 1920 px.
- Options: keep the mockup list with Confirm at build badges; hand written privacy copy; a browser test.
- Why: the Privacy page cannot promise what the code does not do, and jsdom has no layout, so the check reads the real CSS.
- Reversible: yes.

## D-298 List pages reuse the card grid and reserve 70vh while loading (lane L2, M41-S08)

Decision: the View all list pages keep the shared `.web-grid` (2, 3, 4, 5 across, and 6 from 1920) and their skeleton uses the same grid with ten card shapes inside a region that holds `min-height: 70vh`. Options: a separate list grid with its own columns, or a fixed pixel height. Why: one grid means one set of columns to test, and 70vh covers two rows of cards at every width so the footer does not jump when cards arrive. Reversible: yes, CSS only.

## D-299 Sponsor report CSV is built inline, no staff_exports kind (lane L9)
- Decision: The sponsor CSV is generated in the request and returned at once, admin only, audited as `sponsor.report.export`, refused above 10,000 rows and above 400 days. No `sponsor` kind is added to `staff_exports` and no export worker job runs.
- Options: Add the `sponsor` kind to `staff_exports` and queue every export, build it inline with a size cap.
- Why: The data is one row per day, creative and placement, so even 400 days of ten creatives is far under the cap. Inline needs no migration, no stored file and no expiry to manage. The plan's queue step stays available if a range ever outgrows the cap.
- Reversible: Yes. Adding the kind and routing large ranges to the queue later changes only the route.

## D-300 Translations start from the approved spoken language track and land unpublished (lane L7)
- Decision: The caption.translate job reads the approved revision of the video's spoken language, translates cue text only (timings copied), and stores an in_review revision with source translation, source_caption_id and source_sha256 on a subtitles track created with published false and is_default false. One job per video at a time (the open job per queue and video rule), so a second request returns deduplicated. The web side asks the service, which checks staff role, content.languages, engine configured and pair supported before queueing. Notices reuse the captions_ready and captions_failed kinds and name the language.
- Options: New notice kinds; separate queue per language; reuse the one open job rule
- Why: No schema change, the approved English track keeps playing, and nothing reaches a viewer until a human approves and publishes the language (R23, plan 4.5).
- Reversible: Yes

## D-301 Error pages carry one action, with no Report link (lane L6, M45)
- Decision: the 404, removed video and series, server error, root error and offline pages each show exactly one action (Back to Home, Back to Home, Try again, Reload the page, Try again). The reference and the support email are plain text. A search field and popular titles sit beside the message and are not actions. The Report link of M45-S14 AC3 is dropped, so the story is reworded.
- Options: keep a Report link that replaces Try again; a mailto link as a second action.
- Why: R39 allows one action, and Try again recovers more viewers than a prefilled email.
## D-302 The bell is a link on phones and a popover from 960 px, and the count is never polled under Data saver (lane L5, M44-S11)
- Decision: `ViewerBell` renders an anchor to `/notifications` until a `min-width: 960px` match, then a button that opens a dialog popover (latest 10, Escape and click outside close it, focus returns to the bell). The count is fetched on route change and every 5 minutes while the tab is visible, and skipped under Data saver (fetched when opened). The count route answers `{count: 0}` for a kids profile, all other notice routes answer 403.
- Options: popover everywhere, a page everywhere, polling with Data saver exempt.
- Why: popovers are hostile at 360 px (plan 4.5), the page works without script, and Data saver users keep their data.
- Reversible: yes.

## D-303 The Add section dialog offers the seven addable types, and Save draft stays open when a link is invalid (lane L2, M41-S06, S07)

Decision: the dialog lists Manual list, Category, New, Trending, Series, Each category and All series. Continue learning and My List are built in and are not offered, so they cannot be added twice. A bad custom View all link blocks Publish and shows its message under the field, but Save draft still works so an editor never loses half finished work. Options: list all nine types and refuse two with an error, or block Save draft as well. Why: refusing after a choice is worse than not offering it, and a draft is not visible to viewers. Reversible: yes, UI only.

## D-304 Synonyms save as one whole list and the editor never opens empty after a failed load (lane L6, M45)
- Decision: the Discovery tab saves the synonym text as the full list in one transaction, checks it line by line first (shape, repeats), and records one audit entry with the group count only. When the list cannot be loaded the editor is replaced by an error, so a save cannot erase the groups. The empty search report offers Add synonym, which appends a line to the editor.
- Options: edit one group at a time; allow saving from an empty editor after a failed load; import from a file.
- Why: the list is small, a whole list replace is simple to reason about, and the textarea is already a paste import.
- Reversible: yes.

## D-305 Maturity UI: rating asked inside the publish dialog, password step inline, meaning text only for default labels (lane L5, M44)
- Decision: the video editor has one Maturity rating select that replaces Suitability and sends `maturityRank`. A video with only a legacy suitability shows the rank it maps to (kids and everyone 0, older 3). The publish dialog asks for a missing rating inline, keeps Publish enabled, explains on press, saves the rating and then publishes. The bulk menu action is Set maturity rating (all or nothing, undo restores each previous rank). The series editor saves the series rank and offers Apply to all N episodes behind a confirm that names how many change. The profile form shows Allow titles rated up to, disabled at G for kids, and raising it uses the same inline account password field as the PIN and the Kids exit, lowering needs none. The plain meaning (all ages, ages 12 and up) shows only beside the default labels, a site that renames the labels shows its own words. Guest playback refuses a title above `maturity.guest_max_rank` at session start and again at key time, Kids mode stays at 0.
- Options: leave publish disabled until rated, a separate password dialog as in the mockup, hardcode the meaning text, check the guest ceiling only when listing.
- Why: the mockup keeps Publish pressable with an error beside the field, one inline password field is already how profile changes ask for it and keeps one code path, renamed labels would contradict a fixed meaning, and a listing only check would leave a shared guest url playable after the ceiling is lowered.
- Reversible: yes.

## D-306 The apply tool seeds Home only when no layout exists, and every launch section is visible to kids (lane L2, M41-S09)

Decision: the `home` step of `launch:apply` publishes the six launch sections only when no layout was ever published or seeded (a stored published config or any row). A site with a layout, even an edited one, reports `unchanged`. All six sections are kids visible, including My List, because kids profiles already filter every list to kid safe titles (M35). Options: overwrite on every run, or seed only the missing sections. Why: overwriting loses client edits, and merging by name is guessy. Editors who want the set back use Restore launch defaults. Reversible: yes.

## D-307 Viewers see a caption track only when approved, published and its language is enabled (lane L7)
- Decision: One rule everywhere a viewer can reach a track: approved revision, caption_tracks.published true, language in content.languages (English only by default). It is applied in the playback session store, CaptionService.publicCaptions, the CC badge on cards and the title detail track list (catalog helper viewerTrackSql). Publishing is a separate Admin only switch (CaptionService.setPublished, audited as caption.language.publish and unpublish), and removing a language from content.languages is the site wide kill switch. The player picks the default track as profile caption language, then interface language, then English, then the only track if there is exactly one, never tracks[0]. A failed non English track falls back to English with a toast.
- Options: Publish on approve; per video switch only; one rule with a separate switch
- Why: Machine drafts that a human approved should still wait for an explicit go live, and a bad language must be removable in one setting. The publish gate for the spoken language track is a separate change (slice 16).
- Reversible: Yes

## D-308 Voice search is built, off for Kids and Data saver, and asks once before the browser listens (lane L6, M45)
- Decision: the search box shows a microphone only when the browser has speech recognition, the profile is not Kids and Data saver is off. The first press asks once ("Your browser may send what you say to its speech service. We do not store what you say."), remembered under `ad:voice:ok`. It listens in Nigerian English and falls back to US English, fills the box with interim words and searches 600 ms after the last final result. Errors use plain words and typing always works.
- Options: leave voice out (it is a Could); start listening on the first press without asking.
- Why: it was cheap on top of the search box, and the browser vendor may process the audio, so a short question is the honest minimum.
- Reversible: yes, remove the button from `SearchBox`.

## D-309 Donation writes go through the worker and one definer function, the web role cannot write donations (lane L9)
- Decision: Webhook events enter through the SECURITY DEFINER `payment_event_insert()` only. The web role can read donations (admins and the donor's own rows) but has no INSERT or UPDATE on `donations`. The worker role changes donation status. Checkout rows (slice 9) get their own definer function.
- Options: Give the web role DML on `donations` with row level policies, definer functions for the web writes and a worker policy for the rest.
- Why: The webhook and checkout run with no signed in account, so a policy on the web role would have to allow anonymous writes to a table that holds personal data. A function that does one insert cannot be steered into anything else.
- Reversible: Yes. Grants and policies are in one migration.
## D-310 A webhook event for an unknown reference is retried twice, then kept as an orphan (lane L9)
- Decision: A `charge.success` for a reference that has no donation row is retried (the job attempt is below 3) because the event can arrive before our checkout row commits. From the third attempt it is stored with outcome `orphan` and no donation changes. A reference that does not have our `ad-don-` shape is an orphan at once.
- Options: Drop unknown references, retry forever, retry a few times then keep.
- Why: Dropping loses a real gift that raced our commit. Retrying forever fills the queue with events for other businesses on a shared Paystack account. The orphan outcome shows in the admin for a person to look at.
- Reversible: Yes. One constant.

## D-311 Analytics stays first party and anonymous, with a guard that blocks trackers until a decision is logged, and a performance budget checked from the build (lane L6, M45)
- Decision: search and share events are dropped when Global Privacy Control or Do Not Track is on, and playback health, errors and vitals stay. `canUse` allows only necessary and functional storage. A test fails if a script loads from an origin outside its list (only Cloudflare Turnstile) or if analytics code uses device storage or cookies. Budgets: 170 KB gzip first load JS per route, at most four preloaded font files and two families, lazy images except the hero, and LCP 2.5 s, CLS 0.1, INP 200 ms measured in the browser. `pnpm perf:budget` checks the build.
- Options: a full consent banner now; no guard; Lighthouse in CI only.
- Why: nothing identified or third party exists, so a banner would have nothing to ask, and the guard keeps it that way.
- Reversible: yes.

## D-312 Hero preview clips: a failure is a state on the video, not a failed job (lane L2, M41-S10)

Decision: `video.preview` catches every error and records `failed` or `skipped` with a plain note on the video, and the job itself ends successfully. The clip is scored on a frame 3 seconds in, a dark or plain video is `skipped`, a missing original is `skipped`, an oversize clip is retried once at crf 31 and then `failed`. Queued state is written when the job is queued, so the hourly sweep never queues a video twice. Options: let the job fail and retry through pg-boss, or fail the video. Why: a clip is decoration, so it must never mark a video failed, and retrying a deterministic failure only burns encoder time. Editors can retry by hand (slice 10). Reversible: yes.
## D-313 The viewer email digest is opt in, merged per account, and its unsubscribe link is a signed token (lane L5, M44-S14, S15)
- Decision: email is Off until the owner picks Daily or Weekly and confirms in plain words, which stores the sealed account address (D-129) and the consent time. One email per account per Lagos day (weekly on Monday), at most 10 title lines merged from non kids profiles and limited by the primary profile's maturity limit through `viewer_notices.rank`. The unsubscribe link and the `List-Unsubscribe` headers carry a stateless HMAC token (purpose `unsubscribe_notices`, account id, one year expiry, key derived from `FIELD_KEK`), so no new database token type is needed. An account email change clears the sealed copy by trigger and the settings page seals it again. The mailer holds back bounced addresses because the worker reads the hashed suppression list.
- Options: a stored token table, sign in to unsubscribe, one email per profile.
- Why: one click unsubscribe works without a session as mail apps expect, households never learn what another profile follows, and no extra table holds secrets.
- Reversible: yes.

## D-314 Google sign in is optional, built on a small OIDC client with PKCE, state and nonce, and links by verified email only (lane L10, M49-S05 to S07, D-L10-03)
- Decision: `Continue with Google` exists only when `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are both set on the server (never in git) and the site setting `features.signin_with_google` is on. Otherwise no button renders and `/api/auth/google/start` and `/callback` answer 404. The flow is the authorization code flow with PKCE (S256), a signed ten minute `ad_oauth` cookie holding state, nonce and verifier, and a full ID token check (RS256 signature against Google's published keys, issuer, audience, expiry, nonce, `sub`, and `email_verified` exactly `true`). Every failure ends on one generic page and writes an audit entry with the reason. Link rules, in `packages/auth/src/oauth/link-rules.ts`: unverified email refused; an existing `(google, sub)` identity signs in whatever the address now is; no account creates a verified account with no password after a "Finish setting up" screen (terms and age consent, same wording as email sign up); a verified password account is never linked silently and must give its password once (wrong tries count toward the sign in lockout); an unverified password account is adopted and its password cleared; staff accounts are refused and audited; suspended is refused, pending deletion opens the cancel session. Viewer two step still applies after Google. A closed sign up (invite only) refuses new Google accounts because Google cannot carry an invite code. The label stays `var(--font-sans)` (one family), not Roboto Medium, as plan 12.2 recommends.
- Options: `arctic` (named in ARCHITECTURE 3.1; rejected here because the flow is about 150 lines on `fetch` and a fake provider makes it fully testable with no new dependency); Auth.js (rejected earlier); link by email automatically (rejected, takeover risk).
- Why: an optional feature that adds no dependency, cannot take over an account, and disappears when the client does not want it.
- Reversible: yes. Remove the keys, or switch the site setting off. The `account_identities` table is additive.

## D-315 Apple sign in is not built (lane L10, D-L10-04)
- Decision: no Sign in with Apple. Apple's rule that requires it applies to native App Store apps that offer other social logins. This is a website and a PWA. Revisit if a native wrapper is ever shipped.
- Options: build it beside Google; leave it out.
- Why: it costs a paid developer account and key handling for no current requirement.
- Reversible: yes.

## D-316 Google only accounts have a null password hash, and password gated actions say "Set a password" (lane L10, D-L10-05)
- Decision: migration `0051_account_identities.sql` drops `password_hash IS NOT NULL` from `accounts_live_has_credentials`. A null hash means "no password": `AccountService.signIn` already runs the dummy verify and returns the generic failure. A Google only account sets a password through Forgot password, and until then actions that ask for the password (Sign out everywhere, turn off two step, new recovery codes, Remove Google) say "Set a password first". The identity row keeps the address only as the lookup hash plus a masked hint (`email_hint`, such as `j***@gmail.com`) for the Security screen. A verified account with no password and no identity cannot happen today, so rule 4 answers it with a refusal that points to Forgot password instead of an emailed code (no new token purpose).
- Options: store a random unusable hash (rejected, hides a real state); an emailed one time code to link (rejected for now, needs a new token purpose).
- Why: the honest state in the database is the safe one, and the unreachable edge stays closed.
- Reversible: yes, with a migration.

## D-317 Caption admin works per language through one optional language argument (lane L7)
- Decision: The admin caption service methods (track, save, approve, upload) take an optional language that defaults to the video's spoken language, so existing callers and fixture data are unchanged. Translation tracks open in the same review screen with the spoken cue beside each cue and timing locked until Unlock timing. Add translation, estimate and the Publish switch are separate permissions (caption.translate Editor, caption.publish_language Admin). The web process learns what engine exists from TRANSLATE_PROVIDER alone (translationCapability), never the API key. Retranslate is offered on Source changed; a Still correct action is not built.
- Options: A separate translation screen; one screen with tabs; language in the URL path
- Why: Reuses the tested review editor and autosave, and keeps links shareable with ?lang=.
- Reversible: Yes

## D-318 My List filter and sort live in the URL as plain links, and Started means real watching (lane L5, M44-S15, S16)
- Decision: `/my-list?filter=started|not_started&sort=oldest|az|za` is rendered on the server with link pills, so a choice survives a refresh and works without script. Started means a progress row at or past the minimum watch time or finished, for the video or any episode of the series. Not started is the exact complement. A to Z and Z to A page on the accent folded lower case title with the row id as the tie break. Continue learning cards take their Next label from the server `nextUp` flag, show the row title from the curated descriptor (default Continue learning, R14), and move Remove from row into a menu with a 6 second Undo.
- Options: client side filtering of the loaded page, a select box, a separate saved views feature.
- Why: client side filtering breaks with paging, and links need no state and are keyboard friendly.
- Reversible: yes. Nothing is stored.
