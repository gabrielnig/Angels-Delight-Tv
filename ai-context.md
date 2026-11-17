# AI Context Matrix

## 1. Project Overview and Current State
Angels Delight TV: free, self-hosted, Netflix-style educational video platform for Sister Vanessa. Stack: Next.js (TypeScript strict) with `/admin`, Postgres (Drizzle), pg-boss, FFmpeg worker, faster-whisper service, Cloudflare R2 plus CDN, Video.js v10 with hls.js. Developer identity: ARKDEV.
State: documentation, design system, skill and mockups done (docs/, `.claude/skills/angels-delight-design-system`). Lane A (foundation) is built: pnpm monorepo, `@ad/web` (home route, `/api/health`), `@ad/worker` (boots pg-boss), `@ad/db` (all tables, migrations, RLS, `withAccount`), `@ad/config` (env loaders), `@ad/storage` (local and S3 drivers), `@ad/ui` (tokens, theme helper), `@ad/shared` (ids, errors, crypto, logger, enums), Docker, CI. Lanes B to J build on these. Package APIs are listed in `docs/DEV-SETUP.md` and the lane A merge report.
Run scoped tests only: `pnpm vitest run <path>`. Integration tests (`*.int.test.ts`) need `TEST_DATABASE_ADMIN_URL` (see `docs/DEV-SETUP.md` section 5). Install the hook once with `pnpm hooks:install`.

## 2. Known Knowns (finalized core)
Architecture and security decisions in `docs/ARCHITECTURE.md`, `docs/SECURITY.md`, `docs/DECISIONS.md`. Do not change without logging a decision.

## 3. Known Unknowns (immediate roadmap)
Lanes B to J in `docs/BUILD-PLAN.md`, now unblocked. Client inputs pending: colours, domain, name, logo, content, languages, launch date, account ownership. Not yet built from lane A scope: `/api/ready`, `db:seed:admin`, `apps/whisper`, `apps/edge`, `compose.prod.yaml`, packages `crypto`, `queue`, `video`.

## 4. Unknown Knowns (implicit patterns)
Owner works in checkpointed batches, wants brief output, recommended options taken without asking, tests first and scoped only, commits as ARKDEV with no AI attribution, emojis, em dashes or en dashes.

## 5. Unknown Unknowns (blindspot log)
- High: Video.js v10 stability unverified (fallback Vidstack). Check at lane G start.
- Medium: Cloudflare Worker free plan limit (about 1,200 plays per day).
- Medium: NDPA obligations (registration, children's data) need a Nigerian practitioner.
- Medium: MinIO image availability for local dev. `minio/minio` was not found on Docker Hub on 2026-11-17 and the default quay tags in `docker-compose.yml` are unverified (D-017). `STORAGE_DRIVER=local` works without it. Docker was not available in the lane A environment, so only `docker compose config` was validated. Dockerfile layouts were checked by running `pnpm deploy` and the Next standalone output on the host.
- Low: pg-boss queue partitions created by the worker rely on default privileges for web access (D-019). Lane D should test enqueue from `ad_app`.
