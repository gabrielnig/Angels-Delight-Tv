# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Lane K1 viewer integration: real catalog, library, profiles, account stats, playback settings, data export, theme, analytics identity and `/api/progress` sink wired into `apps/web`, with fixtures kept behind `VIEWER_FIXTURES=on`, migration 0014 and a real services Playwright smoke.
- Lane B auth: `@ad/auth` (Argon2id passwords, opaque sessions, per account keys with crypto-shredding, sign up and verification, sign in, reset, account changes and deletion, staff TOTP two factor, recovery codes, invites, role changes, `db:seed:admin`), `@ad/security` (rate limiter, lockouts, CSRF, CSP, audit writer), `@ad/mailer` (SMTP and templates), the nonce CSP `proxy.ts`, and the real auth gateway behind the viewer and admin screens.
- Lane C viewer API: `@ad/catalog` and `@ad/viewer` services (profiles, kids mode, home, browse, search, title detail, Continue Watching, My List, publishing), `/api/*` viewer routes, and `pnpm db:seed:demo`.
- Lane A foundation: pnpm workspace with `apps/web` (Next.js, `/api/health`), `apps/worker` (pg-boss boot) and packages `db`, `config`, `storage`, `ui`, `shared`.
- Drizzle schema for every DATA-MODEL table, generated migrations, and hand-written SQL for deferrable constraints, triggers, row level security on accounts, profiles, watch_progress and my_list, and role grants. `withAccount` sets the row level security context.
- Zod env loaders that fail fast, `.env.example` with a test that keeps it complete.
- Storage adapter with local and S3 drivers, signed local URLs, multipart planning and a shared contract suite.
- Design tokens and a validated theme variable helper in `@ad/ui`.
- ESLint (console banned in apps, import boundaries), Prettier, Vitest projects with `test:file` scripts, Playwright stub, `scripts/footprint-check.sh` and a pre-commit hook installer.
- `docker-compose.yml`, Dockerfiles for web and worker, and a CI workflow running lint, typecheck and changed tests only.
- Engineering documentation: architecture, data model, security, TDD protocol, testing strategy, developer setup and deployment guides.
- Changelog and lessons log.

### Changed
- DATA-MODEL: `videos` ready check now requires a non null duration. Upload defaults follow D-006 (8 MiB parts, 5 GiB). DEV-SETUP, ARCHITECTURE layout and env docs match the built repo.

## Lane I
- Added `@ad/analytics`, `@ad/audit`, the PWA (manifest, service worker, install prompt, offline page), Data saver helpers, responsive posters, request ids, error reporter, `/api/ready`, `/api/analytics`, web vitals and the error page. Migration 0008. Decisions D-035 to D-041.
## Lane H: site settings screen

- Add S64 site settings: platform details, features and limits, legal and info pages editor with versions, maintenance mode, launch checklist.

- Lane H: add `getRootTheme` helper for the root layout and docs/lanes/H-theme.md.
### Added (lane G)
- `@ad/player` and the `/watch/[videoId]` page: HLS playback with token and key handling, custom controls, resume, progress, captions viewer, quality, up next, recovery states, sample HLS generator and Playwright smoke.

## Lane D: video pipeline

- Add `@ad/video` (upload, encoding, captions, playback authorization, lifecycle), `@ad/queue` (pg-boss helpers), `apps/whisper`, `apps/edge` and worker handlers for every lane D queue. Migration 0007. Decisions D-027 to D-030, D-037, D-045 to D-048.


## Lane E: viewer UI

- Add the `@ad/ui` component library and the viewer pages in `apps/web`: landing, sign-in, sign-up, verify, recovery, profiles, Home, Browse, Search, title, series, My List, account, legal, help and system pages.

## Lane F: admin UI

- Add the admin area in `apps/web` under `/admin`: shell with role aware menu and breadcrumbs, dashboard, videos list, upload with a resumable multi file queue, video edit with status checklist, poster picker and crop, publish and schedule dialog, encoding queue, captions list and review, series, categories, trash, home curation with live preview, users, roles and invites, audit log with detail panel and CSV export, analytics (overview and per video) with accessible SVG charts, my account and system.
- Add `lib/uploader` (framework free resumable upload engine with fake, simulated and HTTP transports) and `lib/admin` (`can`, cue and poster rules, formatters).
- Add typed admin services with fixture implementations, real audit, analytics and player quality reads with `ADMIN_DATA=real`, and a guard that refuses fixture data in production.

## Lane K2: video delivery integration

- Wire the lane D routes into `apps/web`: `POST /api/play/{id}/session`, playlists at `/api/play/{id}/{file}`, `GET /api/hls/keys/{id}`, the admin upload API, encoding status, caption list and approve, publish, and the development only `/api/dev-storage` and `/api/dev-media` routes, with real sessions, same origin checks, client address handling and the shared rate limiter.
- Add `POST /api/watch/progress` for the player sink, reusing the lane C progress service.
- Attach approved caption tracks to the Watch page data.
- Fix the playback store reading profiles outside the account (row level security hid every profile from the web role).
- Register the nightly analytics rollup, monthly view event prune and monthly audit prune in the worker. Add `DATABASE_URL_MAINTENANCE`, `WHISPER_FAKE` and `WORKER_SCRATCH_MIN_FREE_RATIO`. Migration 0016. Decisions D-079 to D-082.
- Add the real pipeline Playwright spec `apps/web/e2e/video-pipeline.e2e.ts` and `scripts/e2e-video-up.sh`.
