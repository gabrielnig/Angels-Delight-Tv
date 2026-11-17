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

## D-037 Service worker caches static files only (lane I)
- Decision: the worker caches hashed build files, icons, fonts and public posters (when CORS readable), plus a precached offline page. Page HTML, API responses, admin pages, video playlists, segments, keys and captions are never stored, and a request with Range or Authorization is never touched. A failed navigation shows `/offline`. Updates wait until nothing is playing, apply on navigation or when the page is hidden, then show an "Updated" notice. `PWA_ENABLED=false` serves a worker that clears every cache and unregisters. The worker text is served by `/sw.js` with the build id (`APP_VERSION`) baked in.
- Options: also cache page HTML for "recently opened" (S34), or use a build tool such as Workbox.
- Why: pages are personal and phones are shared, so stale or leaked HTML is worse than an offline screen. A short worker with a tested policy is easier to audit than generated code. The "Recently opened" list in S34 can be added later from a local list of titles without caching HTML.
- Reversible: yes.

## D-038 Install prompt and Data saver defaults (lane I)
- Decision: install banner after two visits at least 3 days apart, hidden 30 days after Not now, never after two dismissals or an install. iPhone Safari gets the three step sheet, other iPhone browsers the open in Safari notice. Data saver defaults on for Save-Data or a slow effective type, the viewer's saved choice always wins, and the choice is stored per profile in local storage with an `onChange` hook for the profile service to persist it. Quality cap 360p, posters 320 px.
- Why: matches M25-S01 and M25-S03. Server side persistence waits for the profile service.
- Reversible: yes.
