# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Lane L6 share menu (M45-S06): `ShareMenu` with native share, Copy link, and admin chosen WhatsApp, Facebook, X and Email links, hidden for kids, bottom sheet under 600 px, literal `share.*` messages.
- Lane L6 Discovery tab (M45-S05): settings `seo.*` and `consent.*`, a live search result and share card preview with a 160 character counter, share channel switches, storage notice text and version bump, root metadata that follows the settings, robots.txt and noindex that follow the indexing switch and close staging.
- Lane L6 share images (M45-S03): `/og/title/<slug>` and `/og/series/<slug>` draw a 1200 by 630 jpeg under 300 KB from the poster with a four stop scrim (white text keeps 4.5 to 1 on a white poster), 404 for unpublished titles, default image fallback; `previewMetadata` takes `shareImagePath` and sets `og:locale`.
- Lane L6 structured data (M45-S02): `VideoObject`, `TVSeries`, `BreadcrumbList`, `WebSite` with a search action and `Organization` as escaped JSON-LD on title, series, category and guest Home pages; kids only titles carry `noindex` and no structured data (R26); `isKidsOnlyTitle` in `@ad/catalog`.
- Lane L6 sitemap (M45-S01): `/sitemap.xml` and `/sitemaps/<n>.xml` route handlers over `listSitemapRows` (published titles, series, categories, real lastmod, kids only titles left out), the Sitemap line in robots.txt, 503 with Retry-After on failure.
- Lane L8 design system tuning (M47): fractional row columns that follow the row container, one gutter clamp, mobile first type scale, 250 ms hover and 0 ms press tokens, button size tokens with a 44px hit area, a 1.25 hover card with an enter only delay, a nav that turns solid from a sentinel with a linear fade, a hero with a 10 s rotation and crossfade, skeletons that match real cards, vietnamese font subsets and an Inter fallback, and guard tests for hover, focus, touch targets, reduced motion, copy, fonts and decision ids.
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

### Lane I: analytics, PWA and observability

- Add `@ad/analytics`, `@ad/audit`, the PWA (manifest, service worker, install prompt, offline page), Data saver helpers, responsive posters, request ids, error reporter, `/api/ready`, `/api/analytics`, web vitals and the error page. Migration 0008. Decisions D-035 to D-041.

### Lane H: site settings and theme

- Add S64 site settings: platform details, features and limits, legal and info pages editor with versions, maintenance mode, launch checklist.

- Lane H: add `getRootTheme` helper for the root layout and docs/lanes/H-theme.md.

### Lane G: player

- `@ad/player` and the `/watch/[videoId]` page: HLS playback with token and key handling, custom controls, resume, progress, captions viewer, quality, up next, recovery states, sample HLS generator and Playwright smoke.

### Lane D: video pipeline

- Add `@ad/video` (upload, encoding, captions, playback authorization, lifecycle), `@ad/queue` (pg-boss helpers), `apps/whisper`, `apps/edge` and worker handlers for every lane D queue. Migration 0007. Decisions D-027 to D-030, D-037, D-045 to D-048.

### Lane E: viewer UI

- Add the `@ad/ui` component library and the viewer pages in `apps/web`: landing, sign-in, sign-up, verify, recovery, profiles, Home, Browse, Search, title, series, My List, account, legal, help and system pages.

### Lane F: admin UI

- Add the admin area in `apps/web` under `/admin`: shell with role aware menu and breadcrumbs, dashboard, videos list, upload with a resumable multi file queue, video edit with status checklist, poster picker and crop, publish and schedule dialog, encoding queue, captions list and review, series, categories, trash, home curation with live preview, users, roles and invites, audit log with detail panel and CSV export, analytics (overview and per video) with accessible SVG charts, my account and system.
- Add `lib/uploader` (framework free resumable upload engine with fake, simulated and HTTP transports) and `lib/admin` (`can`, cue and poster rules, formatters).
- Add typed admin services with fixture implementations, real audit, analytics and player quality reads with `ADMIN_DATA=real`, and a guard that refuses fixture data in production.

### Lane K2: video delivery integration

- Wire the lane D routes into `apps/web`: `POST /api/play/{id}/session`, playlists at `/api/play/{id}/{file}`, `GET /api/hls/keys/{id}`, the admin upload API, encoding status, caption list and approve, publish, and the development only `/api/dev-storage` and `/api/dev-media` routes, with real sessions, same origin checks, client address handling and the shared rate limiter.
- Add `POST /api/watch/progress` for the player sink, reusing the lane C progress service.
- Attach approved caption tracks to the Watch page data.
- Fix the playback store reading profiles outside the account (row level security hid every profile from the web role).
- Register the nightly analytics rollup, monthly view event prune and monthly audit prune in the worker. Add `DATABASE_URL_MAINTENANCE`, `WHISPER_FAKE` and `WORKER_SCRATCH_MIN_FREE_RATIO`. Migration 0016. Decisions D-079 to D-082.
- Add the real pipeline Playwright spec `apps/web/e2e/video-pipeline.e2e.ts` and `scripts/e2e-video-up.sh`.

### Lane J2: quality review

- Remove unused code and four unused dependencies, show an invite as expired only for rejected tokens, and bring DEV-SETUP, ARCHITECTURE, DATA-MODEL and TESTING in line with the built repo. Findings are in `docs/QUALITY-REVIEW.md`.

### Lane M3: media and brand

- Add image variants and generated posters, sprite seek previews, failed encode cleanup, caption script alignment, a placeholder brand kit, six theme presets with a publish e2e, and branded emails. See `docs/lanes/M3-media-brand.md`.

### Lane M1: launch tooling

- Added `pnpm launch:apply`, `pnpm secrets:generate`, `pnpm content:import`, `pnpm backup:run` and `pnpm backup:restore` in the new `@ad/launch` package, `client.example.json`, the production compose file, Caddyfile, `ops/` scripts, tools image and `.env.production.example`, `/healthz` and `/readyz`, a Lighthouse mobile budget, and `docs/LAUNCH-RUNBOOK.md` and `docs/CLIENT-INPUTS.md`. `docs/DEPLOYMENT.md` and `docs/DEV-SETUP.md` now match what was built.
### Lane A2: admin stories audit

- Audit M12 to M20 and M27 to M30 stories, merge the audit writers, read retention from settings, add invite codes, fix analytics export rows, keep series rows on Home in step, page the video list in the database, coalesce caption autosaves, and add the staff bell with email choices.

### Lane P1: sign in and sign up to the mockups

- Rebuilt S01 sign in (landing split and mobile) and S02 sign up (desktop bar, card, mobile sticky submit) to match `S01_landing_sign_in*.dc.html` and `S02_sign_up*.dc.html`, including every stacked state, with Space Grotesk headings, the four segment strength meter and checklist, Caps Lock hint, invite code field and the session ended notice from `?notice=ended`. Real auth behaviour, Turnstile and enumeration safe messages are unchanged. See `docs/lanes/P1-auth-pages.md`.

### Lane R1: three viewer stories

- Added the en-NG message catalog (`@ad/shared/messages`) with auth, account and player copy wired through it, the Always ask who is watching device setting, and a cached profile picker with a stale note.

### Lane L7 review: Languages mockups

- Fixed S140 to S149 for targets, switches, contrast, the 240 px header, Editor and detection states, and wrote the L7 review.

### Lane L3: Admin polish, bulk actions, captions control

- Added a shared bulk framework (selection, bar, progress, report, undo) and bulk actions for videos, captions approval, captions availability, encoding retry and cleanup, Trash restore and delete forever, series, viewer accounts and staff.
- Added upload shared details and a per-file override table, one breadcrumb component, and table alignment and stacked mobile cards.
- Series delete is now admin only. Restore from Trash returns a video as a draft.
- Publish later on upload (L3-16) is not built yet.

### Lane L1: Guest access (M40)

- Anyone can now browse, search and watch without an account. A visitor gets a guest header, tab bar and footer, the full title and series pages, and the player, from an account free catalog path that reads no personal table. Personal routes stay 401 for a guest.
- Added the guest identity cookie, guest playback tokens (`gst`, `kd`) and 20 minute guest segment links (setting `limits.guest_segment_minutes`), with the Edge Worker unchanged.
- Added a Sign in to save dialog, a My List explainer, a remembered save that finishes after sign in, Continue learning and episode progress from the device, and an import of device history into a profile after sign in.
- Added Kids mode for visitors (a device switch, kids safe tokens and analytics, a blocked screen, and the kids profile hint), and the settings `features.guest_play` and `features.guest_audience` with `client.json` fields `guestPlay` and `guestAudience`.
- Added limits for guest sessions and a Turnstile check after 3 refusals from one network in 10 minutes, and `robots.txt` with `noindex` on search and My List.
- Fixed documents: segment URLs live 2 hours for accounts (SECURITY.md said 6), a kids profile on a non-kid video gets 404 (M31-S01), and the key limits in M31-S02.
- Not built: Clear history on this device (M40-S18), the audience select on the admin Features screen, and the Playwright journey specs.


### Lane L9: Sponsors and donations (M48)

- Slice 0: docs now allow labelled sponsor cards and hosted checkout donations, both off by default and never for kids. Added 38 monetization settings (all off, client inputs empty), cross key checks, and the `PAYSTACK_SECRET_KEY`, `PAYSTACK_BASE_URL` and `DONATE_RECEIPT_TOKEN_SECRET` variables.
