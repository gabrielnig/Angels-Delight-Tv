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
