# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
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
