# AI Context Matrix

## 1. Project Overview and Current State
Angels Delight TV: free, self-hosted, Netflix-style educational video platform for Sister Vanessa. Stack: Next.js (TypeScript strict) with `/admin`, Postgres (Drizzle), pg-boss, FFmpeg worker, faster-whisper service, Cloudflare R2 plus CDN, hls.js behind our own player interface (D-042). Developer identity: ARKDEV.

State (main, after lane J2 review): lanes A to I and the K1 and K2 integration passes are merged, and K3 (admin catalog services, caption review wired to the real caption service) is landing. Everything runs on real services when real auth is configured, and on fixtures only with the dev flags below. 16 migrations (0000 to 0016), decisions logged up to D-083, per lane notes in `docs/lanes/`.

Apps: `@ad/web` (viewer site, `/admin`, `/api/*`, `/watch/[videoId]`, PWA with service worker, `/api/health`, `/api/ready`), `@ad/worker` (pg-boss consumers for every video queue, nightly analytics rollup, monthly view event and audit prune), `apps/whisper` (Python faster-whisper service, `WHISPER_FAKE` for dev), `apps/edge` (Cloudflare Worker for signed segment URLs).
Packages: `db` (schema, migrations, RLS, `withAccount`), `config`, `shared`, `storage` (local and S3), `ui` (tokens and component library), `auth` (Argon2id, sessions, per account keys, staff TOTP, invites), `security` (rate limiter, lockouts, CSRF, CSP, IP handling), `mailer`, `audit`, `analytics`, `queue`, `video` (upload, encode, captions, playback authorization, purge), `catalog`, `viewer`, `player`, `theme`. Layout and import rules: `docs/ARCHITECTURE.md` section 4.
Data modes: `VIEWER_FIXTURES=on`, `AUTH_FIXTURES=on`, `ADMIN_DATA=fixture` give fixtures outside production. Production always uses real services. Seeds: `pnpm db:seed:admin`, `pnpm db:seed:demo`.
Run scoped tests only: `pnpm vitest run <path>`. Integration tests (`*.int.test.ts`) need `TEST_DATABASE_ADMIN_URL` (see `docs/DEV-SETUP.md` section 5). Install the hook once with `pnpm hooks:install`. Quality findings and the repeatable sweep: `docs/QUALITY-REVIEW.md`.

## 2. Known Knowns (finalized core)
Architecture and security decisions in `docs/ARCHITECTURE.md`, `docs/SECURITY.md`, `docs/DECISIONS.md`. Do not change without logging a decision.

## 3. Known Unknowns (immediate roadmap)
Client inputs pending: colours, domain, name, logo, content, languages, launch date, account ownership. Plan and lane table: `docs/BUILD-PLAN.md`.
Not built yet (from the lane reports): `compose.prod.yaml` and deploy and backup scripts; Turnstile on sign in and sign up; the 14 day deletion grace period (D-059 deletes at once); emailed or background data export; PIN entry UI for protected profiles; poster and image processing handler (`image.process`) so posters are not generated; cleanup screen for failed encodes; audit retention from settings (24 month default is used); sprite sheet seek previews; legal and site content pages still fixtures; invite codes tab; server side player preferences; Lighthouse budget in CI; `/healthz` and `/readyz` aliases.
Not run in any lane: `next build`, S3 or MinIO, the Cloudflare edge worker, a real faster-whisper model, Docker images (only `docker compose config`).
Open review items needing a decision (details in `docs/QUALITY-REVIEW.md` section 2): history cleanup for one commit with AI trailers and two with non ARKDEV authors, the committer rule versus the GitHub merge API, and merging the two audit writers (`@ad/security` and `@ad/audit`).

## 4. Unknown Knowns (implicit patterns)
Owner works in checkpointed batches, wants brief output, recommended options taken without asking, tests first and scoped only, commits as ARKDEV with no AI attribution, emojis, em dashes or en dashes.

## 5. Unknown Unknowns (blindspot log)
- Medium: Cloudflare Worker free plan limit (about 1,200 plays per day).
- Medium: NDPA obligations (registration, children's data) need a Nigerian practitioner.
- Low: Video.js v10 was confirmed stable and the player uses its pinned hls.js build behind our own interface (D-042).
- Medium: MinIO image availability for local dev. `minio/minio` was not found on Docker Hub on 2026-11-17 and the default quay tags in `docker-compose.yml` are unverified (D-017). `STORAGE_DRIVER=local` works without it. Docker was not available in the lane A environment, so only `docker compose config` was validated. Dockerfile layouts were checked by running `pnpm deploy` and the Next standalone output on the host.
- Low: pg-boss queue partitions created by the worker rely on default privileges for web access (D-019). Lane D should test enqueue from `ad_app`.
