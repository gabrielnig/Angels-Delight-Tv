# Developer Setup

Status: matches main after the lane K integration passes. Update this file in the same change as any setup step that changes.

Related: `docs/ARCHITECTURE.md`, `docs/TDD-PROTOCOL.md`, `docs/TESTING.md`.

## 1. Prerequisites

| Tool | Version | Notes |
|---|---|---|
| Node.js | 24 from `.nvmrc` (22.12 or newer also works) | Use `nvm`, `fnm` or Volta |
| pnpm | pinned in `package.json` `packageManager` | `corepack enable` |
| Docker Engine and Compose plugin | recent | Linux, macOS or Windows with WSL2 |
| FFmpeg and ffprobe | 6 or newer | Only if running the worker on the host. The compose worker image bundles it |
| Python | 3.12 | Only if running `apps/whisper` on the host |
| Git | 2.40 or newer | |

Minimum machine: 8 GB RAM for the core stack. The whisper service needs about 2 GB extra and is optional in dev.

## 2. First-time setup

```bash
git clone <repo-url> angels-delight-tv && cd angels-delight-tv
git config user.name ARKDEV
git config user.email "<project email>"

corepack enable
pnpm install --frozen-lockfile

cp .env.example .env            # names only, fill dev values (see section 4)
docker compose up -d postgres minio minio-init mailpit
pnpm --filter @ad/db db:migrate        # needs DATABASE_URL_MIGRATE in .env or the shell
pnpm --filter @ad/web dev              # http://localhost:3000, health at /api/health
pnpm --filter @ad/worker dev           # second terminal
```

Seed the first admin with `pnpm db:seed:admin`. It prompts for the email and password, needs `DATABASE_URL_MIGRATE`, `KEYS_DATABASE_URL`, `FIELD_KEK` and `EMAIL_HASH_PEPPER` in the environment, and refuses to run when an admin exists. `pnpm db:seed:demo` adds demo catalog data in development and refuses to run in production.

Data modes in development: with real auth configured, viewer and admin screens use the real services. `VIEWER_FIXTURES=on`, `AUTH_FIXTURES=on` and `ADMIN_DATA=fixture` switch to in memory fixtures for UI work. Production always uses real services. The flags are listed in `docs/lanes/K1-viewer-integration.md` and `docs/lanes/F-admin-ui.md`.

Install the git hook with `pnpm run hooks:install`. It runs the footprint check, gitleaks when installed, and `vitest related --run` on staged `.ts` and `.tsx` files (config files are skipped on purpose, vitest reruns everything when a config changes).

## 3. Docker Compose (local)

`docker-compose.yml` services:

| Service | Image or build | Ports | Purpose |
|---|---|---|---|
| `postgres` | `postgres:17-alpine` | 5432 | App DB, `pgboss` schema, test databases. A init script also creates the `ad_keys` database and the roles from DATA-MODEL.md section 2 |
| `minio` | `MINIO_IMAGE`, default `quay.io/minio/minio:RELEASE.2025-04-22T22-12-26Z` (see note) | 9000 API, 9001 console | Stands in for R2. CORS comes from `MINIO_API_CORS_ALLOW_ORIGIN` (set to `APP_ORIGIN`) |
| `minio-init` | `MC_IMAGE`, default `quay.io/minio/mc:RELEASE.2025-04-16T18-13-26Z`, runs `docker/minio/init.sh` | none | Creates buckets `ad-originals` and `ad-media`, allows anonymous read of `ad-media` prefix `v/`, `img/`, `cap/` |
| `mailpit` | `axllent/mailpit:v1.34` | 1025 SMTP, 8025 UI | Catches verification and reset emails |
| `migrate` | build `apps/worker` | none | Profiles `full` and `ops`. Runs the migrations as `ad_migrator`, then exits |
| `web` | build `apps/web` | 3000 | Profile `full` only |
| `worker` | build `apps/worker` | none | Profile `full` only. Has FFmpeg |
| `caddy` | `caddy:2-alpine`, config in `docker/caddy/Caddyfile` | 80, 443 | Profile `proxy` only. Gives `https://localhost` with an internal certificate |
| `whisper` | build `apps/whisper` | 8000 | faster-whisper over a small HTTP service. Profiles `captions` and `full`. Downloads its model into the `whisper-models` volume on first start. Tests: `pnpm --filter @ad/whisper test:py` |

Note on MinIO: its community distribution has changed (the `minio/minio` repository was not found on Docker Hub when this was checked on 2026-11-17). The default tags above were not pulled in the lane A environment. Set `MINIO_IMAGE` and `MC_IMAGE` to images you have pulled and verified, keep `STORAGE_DRIVER=s3` vendor neutral so Garage, SeaweedFS or RustFS can replace it, or use `STORAGE_DRIVER=local` (see section 4) which needs no container. Logged as D-017.

Postgres init: on the first start of an empty volume, `packages/db/sql/roles.sql` creates the service roles, then `docker/postgres/init/01-logins.sh` gives them the throwaway `DB_ROLE_PASSWORD` (default `dev`), makes `ad_migrator` own the `ad` database and creates the `ad_keys` database. Change a role password later with `ALTER ROLE`, or reset with `docker compose down -v`.

Two ways to work:

```bash
# A. Daily development: infra in Docker, apps on the host (fast reload)
docker compose up -d postgres minio minio-init mailpit
pnpm --filter @ad/web dev
pnpm --filter @ad/worker dev

# B. Everything in containers (closest to production)
docker compose --profile full --profile proxy up -d --build

# Optional captions
docker compose --profile captions up -d whisper
```

The `web` and `worker` images run the production build, which sets `NODE_ENV=production`. The production rules in `packages/config` therefore apply: `APP_ORIGIN` and `MEDIA_ORIGIN` must be https, `STORAGE_DRIVER=s3`, `DEV_SKIP_MFA` off. Use the `proxy` profile for local https and set the origins in `.env` to match. Day to day, use route A. Logged as D-022.

Validate the file without a Docker daemon: `docker compose --profile full --profile proxy --profile ops config -q`.

Compose rules: named volumes for Postgres and MinIO data, healthchecks on `postgres` and `minio`, `depends_on` with `condition: service_healthy`, log rotation options on every service, non-root users in app images, secrets only from `.env` (not committed).

Reset everything: `docker compose down -v` (deletes local data).

## 4. Dev environment values

Start from `.env.example`. Typical development values:

```bash
NODE_ENV=development
APP_ORIGIN=http://localhost:3000
MEDIA_ORIGIN=http://localhost:9000/ad-media
COOKIE_PREFIX_SECURE=false
TRUSTED_PROXY_MODE=none
EDGE_TOKEN_MODE=off

DATABASE_URL=postgres://ad_app:dev@localhost:5432/ad
DATABASE_URL_WORKER=postgres://ad_worker:dev@localhost:5432/ad
DATABASE_URL_MAINTENANCE=postgres://ad_maintenance:dev@localhost:5432/ad
DATABASE_URL_MIGRATE=postgres://ad_migrator:dev@localhost:5432/ad
KEYS_DATABASE_URL_MIGRATE=postgres://ad_migrator:dev@localhost:5432/ad_keys
KEYS_DATABASE_URL=postgres://ad_keys_app:dev@localhost:5432/ad_keys
KEYS_DATABASE_URL_SHRED=postgres://ad_keys_shred:dev@localhost:5432/ad_keys

# generate each with: openssl rand -base64 32
FIELD_KEK=
EMAIL_HASH_PEPPER=
HLS_KEK=
PLAYBACK_TOKEN_SECRET=
MEDIA_URL_SECRET=

STORAGE_DRIVER=s3
S3_ENDPOINT=http://localhost:9000
S3_REGION=auto
S3_FORCE_PATH_STYLE=true
S3_ACCESS_KEY_ID=minioadmin                 # same as MINIO_ROOT_USER
S3_SECRET_ACCESS_KEY=minioadmin-dev         # same as MINIO_ROOT_PASSWORD
BUCKET_ORIGINALS=ad-originals
BUCKET_MEDIA=ad-media

SMTP_URL=smtp://localhost:1025
EMAIL_FROM=no-reply@localhost
WHISPER_URL=http://localhost:8000
FFMPEG_PRESET=veryfast
WORKER_SCRATCH_DIR=/tmp/ad-work
```

Dev databases use throwaway passwords. Never reuse production values. Generate dev keys per developer, they are not shared.

Using the local storage driver instead of MinIO: set `STORAGE_DRIVER=local` and `LOCAL_STORAGE_ROOT=./.local-storage`. The driver (`@ad/storage`) returns HMAC signed `/api/dev-storage/...` URLs and exports `verifyLocalUrl` and `LocalStorage.receivePart` for the dev-only route that handles part uploads. That route is built by the upload lane (D) and must refuse to mount in production. The env loader already rejects `STORAGE_DRIVER=local` when `NODE_ENV=production`.

Every variable is validated at boot by `@ad/config` (`loadWebEnv`, `loadWorkerEnv`, `loadMigrateEnv`). A bad or missing value stops the process and names the variable, never the value. `.env.example` lists every variable, and a test keeps it in sync.

## 5. Everyday commands

| Task | Command |
|---|---|
| Start web | `pnpm --filter @ad/web dev` |
| Start worker | `pnpm --filter @ad/worker dev` |
| Type check everything | `pnpm typecheck` |
| Type check one package | `pnpm --filter @ad/web typecheck` |
| Lint everything | `pnpm lint` |
| Lint one package | `pnpm --filter @ad/web lint` |
| Format check | `pnpm format:check` (`pnpm format` writes) |
| Generate a migration from schema changes | `pnpm --filter @ad/db db:generate` |
| Create a hand-written SQL migration (RLS, triggers, grants) | `pnpm --filter @ad/db db:generate --custom --name=add_profiles_rls` |
| Generate a keys database migration | `pnpm --filter @ad/db exec drizzle-kit generate --config drizzle.keys.config.ts` |
| Apply migrations | `pnpm --filter @ad/db db:migrate` |
| Open Drizzle Studio | `pnpm --filter @ad/db db:studio` |
| Run one test file | `pnpm vitest run path/to/file.test.ts` |
| Run one test file through a package script | `pnpm --filter @ad/storage test:file src/local.test.ts` |
| Run tests related to a changed file | `pnpm vitest related --run path/to/file.ts` |
| Run one e2e spec | `pnpm exec playwright test apps/web/e2e/health.e2e.ts --config apps/web/playwright.config.ts` |
| Footprint check on staged changes | `scripts/footprint-check.sh` |
| Footprint check on a branch | `scripts/footprint-check.sh --range origin/main..HEAD` |

Packages deliberately have no `test` script. Each has `test:file`, which is `vitest run` and needs a path (`pnpm --filter @ad/config test:file src/env.test.ts`), so nothing runs the whole suite by accident.

Integration tests (`*.int.test.ts`) need a Postgres superuser. They skip themselves when `TEST_DATABASE_ADMIN_URL` is unset. With the compose Postgres running:

```bash
export TEST_DATABASE_ADMIN_URL=postgres://postgres:dev@localhost:5432/postgres
pnpm vitest run packages/db/src/rls.int.test.ts
```

Each run creates throwaway `ad_test_*` databases owned by `ad_migrator`, applies the migrations as that role like a real deploy, and drops them afterwards.

Never run the whole suite (see TDD-PROTOCOL.md section 2).

## 6. Working with media locally

- Make a test clip: `ffmpeg -f lavfi -i testsrc=duration=20:size=1280x720:rate=30 -f lavfi -i sine=duration=20 -c:v libx264 -pix_fmt yuv420p -c:a aac sample.mp4`.
- Upload it at `http://localhost:3000/admin` as the seeded admin (TOTP can be bypassed in development only through `DEV_SKIP_MFA=true`, which the env schema rejects when `NODE_ENV=production`).
- Watch the job: `docker compose logs -f worker` or the admin encoding status table.
- Inspect outputs in the MinIO console at `http://localhost:9001` (buckets `ad-originals`, `ad-media`).
- Emails appear at `http://localhost:8025`.
- Encode faster in dev with `FFMPEG_PRESET=veryfast` and a short clip.

### Real video pipeline run (no fixtures)

`scripts/e2e-video-up.sh [port]` prepares databases `ad_e2e` and `ad_e2e_keys` on the local Postgres, applies the migrations, writes `.env.e2e-video` (throwaway secrets, local storage driver, `WHISPER_FAKE=true`) and seeds an admin and a viewer. Then start the worker and web with that environment and run the spec, see `docs/lanes/K2-video-integration.md`.

## 7. Launch tooling (production files and CLIs)

These live in `packages/launch` and run on the host with `pnpm`, or in the `tools` image in production (`ad-tool <command>`).

| Command | What it does |
|---|---|
| `pnpm secrets:generate` | Creates `.env.production` from `.env.production.example`, fills every empty secret, and writes the two backup keypairs to `offline-keys/`. Keep that folder off the server and out of git |
| `pnpm launch:apply --config client.json [--dry-run]` | Validates the client file, then applies name, domain, contact, theme, logo, favicon, legal pages and PWA icons through the settings and theme services. Safe to run again. `--env-only` updates the env file values with no database |
| `pnpm content:import --dir videos/ --manifest videos.csv --admin-email <owner> [--dry-run]` | Registers each file through the upload service with no HTTP, skips files already imported by checksum, resumes part uploads. The worker must have started once so the queue schema exists |
| `pnpm backup:run`, `pnpm backup:restore` | Encrypted dump and restore (see `docs/DEPLOYMENT.md` section 10) |

`client.example.json` at the repository root is the file to copy. Production files: `compose.prod.yaml`, `ops/`, `.env.production.example`. Scoped tests for them:

```bash
pnpm vitest run packages/launch/src          # config, manifest, apply, import, backup, compose, Caddyfile
pnpm vitest run scripts/ops-deploy.test.ts   # deploy.sh with a fake docker
CADDY_BIN=/path/to/caddy pnpm vitest run packages/launch/src/caddyfile.test.ts   # skips without a caddy binary
export TEST_DATABASE_ADMIN_URL=postgres://postgres:postgres@localhost:5432/postgres   # restore and import integration tests
```

Lighthouse for Home on the mobile profile: `CHROME_PATH=/usr/bin/google-chrome ops/lighthouse/run.sh http://127.0.0.1:3000/` against a running build (budgets in `ops/lighthouse/budget.json`).

## 8. Troubleshooting

| Symptom | Likely cause and fix |
|---|---|
| Upload parts fail with a CORS error | MinIO CORS not applied. Re-run `docker compose run --rm minio-init` and make sure `ETag` is exposed |
| `permission denied for table accounts` in the worker | Expected. The worker role has no identity table grants. Fix the query location, not the grant |
| Playback shows 401 on key request | Token expired or `Authorization` header not set for the app origin. Check `xhrSetup` and clock |
| Segments 404 in dev | `ad-media` anonymous read policy missing. Re-run `minio-init` |
| Migration fails on RLS | Run migrations as `ad_migrator`, not `ad_app` |
| Whisper container out of memory | Use `WHISPER_MODEL=base.en` in dev |
| Cookies not set on localhost | Ensure `COOKIE_PREFIX_SECURE=false` in dev |
