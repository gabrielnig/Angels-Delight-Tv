# AI Context Matrix

## 1. Project Overview and Current State
Angels Delight TV: free, self-hosted, Netflix-style educational video platform for Sister Vanessa. Stack: Next.js (TypeScript strict) with `/admin`, Postgres (Drizzle), pg-boss, FFmpeg worker, faster-whisper service, Cloudflare R2 plus CDN, hls.js behind our own player interface (D-042). Developer identity: ARKDEV.

State (main, 2026-11-18): phases 0 to 4 are done (docs, design system, mockups, foundation, parallel build). Phase 5 hardening is largely done (J2 and J3 reviews, F2 final verification, security review, a11y and touch target gates). Phase 6 handover tooling exists (M1 launch tooling, `docs/LAUNCH-RUNBOOK.md`, `docs/CLIENT-INPUTS.md`, `docs/DEPLOYMENT.md`). Lanes merged: A, A2, B, C, D, E, F, F2, F3, G, H, I, J2, J3, K1, K2, K3, M1, M2, M3, P1 (S01, S02), P3 (S27 to S31), a1 (viewer stories audit), a3 (platform), Q1 (cleanup). About 155 PRs have been opened and merged on GitHub, all rebase merged. Everything runs on real services when real auth is configured, and on fixtures only with the dev flags below. 34 main migrations (0000 to 0033, plus a keys database), decisions logged up to D-152, per lane notes in `docs/lanes/`. The account deletion grace period exists (pending deletion, cancel, closing screen; D-150), and exports over 10,000 rows run as background jobs with an emailed link.

Apps: `@ad/web` (viewer site, `/admin`, `/api/*`, `/watch/[videoId]`, PWA with service worker, `/api/health`, `/api/ready`), `@ad/worker` (pg-boss consumers for every video queue, nightly analytics rollup, monthly view event and audit prune), `apps/whisper` (Python faster-whisper service, `WHISPER_FAKE` for dev), `apps/edge` (Cloudflare Worker for signed segment URLs).
Packages: `db` (schema, migrations, RLS, `withAccount`), `config`, `shared`, `storage` (local and S3), `ui` (tokens and component library), `auth` (Argon2id, sessions, per account keys, staff TOTP, invites), `security` (rate limiter, lockouts, CSRF, CSP, IP handling), `mailer`, `audit`, `analytics`, `queue`, `video` (upload, encode, captions, playback authorization, purge), `catalog`, `viewer`, `player`, `theme`. Layout and import rules: `docs/ARCHITECTURE.md` section 4.
Data modes: `VIEWER_FIXTURES=on`, `AUTH_FIXTURES=on`, `ADMIN_DATA=fixture` give fixtures outside production. Production always uses real services. Seeds: `pnpm db:seed:admin`, `pnpm db:seed:demo`.
Run scoped tests only: `pnpm vitest run <path>`. Integration tests (`*.int.test.ts`) need `TEST_DATABASE_ADMIN_URL` (see `docs/DEV-SETUP.md` section 5). Install the hook once with `pnpm hooks:install`. Quality findings and the repeatable sweep: `docs/QUALITY-REVIEW.md`.

Lane f1 (2026-11-18) closed the last admin and ops gaps: Super admin, email outbox, background exports, storage estimate, backup manifest and 14 daily plus 8 weekly retention, `pnpm dns:check`, poster scoring, AVIF and stored blur. See `docs/lanes/F1-final-admin.md`. Decisions D-128 to D-134.

## 2. Known Knowns (finalized core)
Architecture and security decisions in `docs/ARCHITECTURE.md`, `docs/SECURITY.md`, `docs/DECISIONS.md`. Do not change without logging a decision.

## 3. Known Unknowns (immediate roadmap)
Client inputs pending: colours, domain, name, logo, content, languages, launch date, account ownership. Plan and lane table: `docs/BUILD-PLAN.md`.
Unbuilt Should stories: M03-S11 (remember last profile per device), M03-S13 (profile picker on slow networks), M34-S04 (text in catalogs), M08-S27 (poster and first frame), M06-S09 (search result layout and loading; listed Must in USER-STORIES, check the file). Other gaps are in the lane notes under `docs/lanes/`.
Built but NOT verified in a real environment: Docker image builds (only `docker compose config`, `pnpm deploy` and the Next standalone output on the host), Cloudflare R2 and the edge Worker deployment, real SMTP delivery, the real faster-whisper model, a real screen reader pass, a real VPS deploy, GitHub Actions on a runner.
Remaining owner actions: delete about 135 remote lane branches on GitHub (the agent proxy blocks branch deletion); NDPA legal review by a Nigerian practitioner; supply the client inputs above.
Open review items (`docs/QUALITY-REVIEW.md` section 2): the committer rule versus the GitHub merge API (rebase merges set the committer to the token owner, accepted), and merging the two audit writers (`@ad/security` and `@ad/audit`).

## 4. Unknown Knowns (implicit patterns)
Owner works in checkpointed batches, wants brief output, recommended options taken without asking, tests first and scoped only, commits as ARKDEV with no AI attribution, emojis, em dashes or en dashes.

## 5. Unknown Unknowns (blindspot log)
- Medium: Cloudflare Worker free plan limit (about 1,200 plays per day).
- Medium: NDPA obligations (registration, children's data) need a Nigerian practitioner.
- Low: Video.js v10 was confirmed stable and the player uses its pinned hls.js build behind our own interface (D-042).
- Medium: MinIO image availability for local dev. `minio/minio` was not found on Docker Hub on 2026-11-17 and the default quay tags in `docker-compose.yml` are unverified (D-017). `STORAGE_DRIVER=local` works without it. Docker was not available in the lane A environment, so only `docker compose config` was validated. Dockerfile layouts were checked by running `pnpm deploy` and the Next standalone output on the host.
- Low: pg-boss queue partitions created by the worker rely on default privileges for web access (D-019). Lane D should test enqueue from `ad_app`.
