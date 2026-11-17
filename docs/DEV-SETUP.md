# Developer Setup

Status: written before the repo is scaffolded. Script names and service names below are the contract the scaffold must implement. Update this file in the same change as any setup step that changes.

Related: `docs/ARCHITECTURE.md`, `docs/TDD-PROTOCOL.md`, `docs/TESTING.md`.

## 1. Prerequisites

| Tool | Version | Notes |
|---|---|---|
| Node.js | current LTS (24 at time of writing), from `.nvmrc` | Use `nvm`, `fnm` or Volta |
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
pnpm --filter @ad/db db:migrate
pnpm --filter @ad/db db:seed:admin     # prompts for the first admin email and password
pnpm --filter @ad/web dev              # http://localhost:3000
pnpm --filter @ad/worker dev           # second terminal
```

Install git hooks (pre-commit scoped tests, footprint check, gitleaks) with `pnpm run hooks:install`.

## 3. Docker Compose (local)

`compose.yaml` services:

| Service | Image or build | Ports | Purpose |
|---|---|---|---|
| `postgres` | `postgres:17-alpine` | 5432 | App DB, `pgboss` schema, test databases. A init script also creates the `ad_keys` database and the roles from DATA-MODEL.md section 2 |
| `minio` | S3-compatible server, pin a known-good tag or digest (see note) | 9000 API, 9001 console | Stands in for R2 |
| `minio-init` | `mc` client one-shot | none | Creates buckets `ad-originals` and `ad-media`, sets CORS, allows anonymous read of `ad-media` prefix `v/`, `img/`, `cap/` |
| `mailpit` | `axllent/mailpit` | 1025 SMTP, 8025 UI | Catches verification and reset emails |
| `web` | build `apps/web` | 3000 | Profile `full` only |
| `worker` | build `apps/worker` | none | Profile `full` only. Has FFmpeg |
| `whisper` | build `apps/whisper` | 8000 | Profile `captions` only, downloads the model on first start |

Note on MinIO: its community distribution has changed recently (reduced maintenance and image publishing). Pin an image you have pulled and verified, and keep `STORAGE_DRIVER=s3` vendor neutral so Garage or SeaweedFS can replace it.

Two ways to work:

```bash
# A. Daily development: infra in Docker, apps on the host (fast reload)
docker compose up -d postgres minio minio-init mailpit
pnpm --filter @ad/web dev
pnpm --filter @ad/worker dev

# B. Everything in containers (closest to production)
docker compose --profile full up -d --build

# Optional captions
docker compose --profile captions up -d whisper
```

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
DATABASE_URL_MIGRATE=postgres://ad_migrator:dev@localhost:5432/ad
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
S3_ACCESS_KEY_ID=
S3_SECRET_ACCESS_KEY=
BUCKET_ORIGINALS=ad-originals
BUCKET_MEDIA=ad-media

SMTP_URL=smtp://localhost:1025
EMAIL_FROM=no-reply@localhost
WHISPER_URL=http://localhost:8000
FFMPEG_PRESET=veryfast
WORKER_SCRATCH_DIR=/tmp/ad-work
```

Dev databases use throwaway passwords. Never reuse production values. Generate dev keys per developer, they are not shared.

Using the local storage driver instead of MinIO: set `STORAGE_DRIVER=local` and `LOCAL_STORAGE_ROOT=./.local-storage`. The dev-only `/api/dev-storage` route handles part uploads. It refuses to mount in production.

## 5. Everyday commands

| Task | Command |
|---|---|
| Start web | `pnpm --filter @ad/web dev` |
| Start worker | `pnpm --filter @ad/worker dev` |
| Type check one package | `pnpm --filter @ad/web typecheck` |
| Lint one package | `pnpm --filter @ad/web lint` |
| Generate a migration from schema changes | `pnpm --filter @ad/db db:generate` |
| Create a hand-written SQL migration (RLS, triggers, grants) | `pnpm --filter @ad/db db:generate --custom --name add_profiles_rls` |
| Apply migrations | `pnpm --filter @ad/db db:migrate` |
| Open Drizzle Studio | `pnpm --filter @ad/db db:studio` |
| Run one test file | `pnpm vitest run path/to/file.test.ts` |
| Run tests related to a changed file | `pnpm vitest related --run path/to/file.ts` |
| Run one e2e spec | `pnpm exec playwright test apps/web/e2e/auth.e2e.ts` |
| Footprint check on staged changes | `scripts/check-footprint.sh` |

Never run the whole suite (see TDD-PROTOCOL.md section 2).

## 6. Working with media locally

- Make a test clip: `ffmpeg -f lavfi -i testsrc=duration=20:size=1280x720:rate=30 -f lavfi -i sine=duration=20 -c:v libx264 -pix_fmt yuv420p -c:a aac sample.mp4`.
- Upload it at `http://localhost:3000/admin` as the seeded admin (TOTP can be bypassed in development only through `DEV_SKIP_MFA=true`, which the env schema rejects when `NODE_ENV=production`).
- Watch the job: `docker compose logs -f worker` or the admin encoding status table.
- Inspect outputs in the MinIO console at `http://localhost:9001` (buckets `ad-originals`, `ad-media`).
- Emails appear at `http://localhost:8025`.
- Encode faster in dev with `FFMPEG_PRESET=veryfast` and a short clip.

## 7. Troubleshooting

| Symptom | Likely cause and fix |
|---|---|
| Upload parts fail with a CORS error | MinIO CORS not applied. Re-run `docker compose run --rm minio-init` and make sure `ETag` is exposed |
| `permission denied for table accounts` in the worker | Expected. The worker role has no identity table grants. Fix the query location, not the grant |
| Playback shows 401 on key request | Token expired or `Authorization` header not set for the app origin. Check `xhrSetup` and clock |
| Segments 404 in dev | `ad-media` anonymous read policy missing. Re-run `minio-init` |
| Migration fails on RLS | Run migrations as `ad_migrator`, not `ad_app` |
| Whisper container out of memory | Use `WHISPER_MODEL=base.en` in dev |
| Cookies not set on localhost | Ensure `COOKIE_PREFIX_SECURE=false` in dev |
