# Lane M1: launch tooling

Branches `lane-m1/*`. Goal: when the client supplies name, domain, colours, logo, content and accounts, launch is about two hours of configuration.

## What was built

- `@ad/launch` package: client config schema and applier (`pnpm launch:apply`), PWA icon generation, env file updates, secrets generator (`pnpm secrets:generate`), content importer (`pnpm content:import`), encrypted backup and restore (`pnpm backup:run`, `pnpm backup:restore`).
- Production files: `compose.prod.yaml`, `ops/Caddyfile`, `ops/deploy.sh`, `ops/backup.sh`, `ops/setup-vps.sh`, `ops/update-cloudflare-ufw.sh`, `ops/Dockerfile.tools`, `ops/ad-tool`, `ops/postgres/01-logins.sh`, `.env.production.example`, `ops/lighthouse/`.
- App: `/healthz` and `/readyz` aliases, PWA icons served from `/brand-icons/` so the applier can change them without a rebuild, caption align mode queued when a manifest script exists.
- Docs: `docs/LAUNCH-RUNBOOK.md`, `docs/CLIENT-INPUTS.md`, updates to `docs/DEPLOYMENT.md` and `docs/DEV-SETUP.md`. Decisions D-094, D-101, D-116, D-117, D-118.

## Scoped tests

```bash
pnpm vitest run packages/launch/src
pnpm vitest run scripts/ops-deploy.test.ts
pnpm vitest run packages/video/src/encode/pipeline.int.test.ts   # needs TEST_DATABASE_ADMIN_URL
export TEST_DATABASE_ADMIN_URL=postgres://postgres:postgres@localhost:5432/postgres
```

## Verified on a machine with no Docker daemon

- `next build` passes with no warnings. The standalone output booted in production mode on the host: `/healthz` 200, `/readyz` 503 with storage failing as expected (no R2), Home 200, a brand icon 200. The production config guard refused the dev env file with the full list of reasons, as designed.
- `docker compose config` on `compose.prod.yaml` for every profile, and tests on the rendered model (networks, read only, dropped capabilities, one role per container, no builds).
- Caddyfile validated and smoke tested with a real Caddy binary: TLS with a test certificate, forwarded headers, http redirect, health, maintenance 503, and signed query and header stripping in logs.
- `launch:apply` dry run, real run and a rerun (all steps unchanged) and `content:import` dry run, real run and rerun (all skipped) against a real Postgres with the real worker encoding the files.
- Backup, encrypt, upload, retention and restore round trip against real `pg_dump` and `pg_restore` 16 with a forced RLS table.
- `deploy.sh` ordering, abort on failed migration, rollback, `--rollback` and no secret output, with a fake docker.
- The tools layout produced by `pnpm --filter @ad/launch deploy --legacy --prod` runs the CLIs under tsx. This found a missing `react` dependency (via `@ad/ui`), now added.
- Lighthouse 13 on the mobile profile against the standalone build: performance 0.79, accessibility 1, best practices 0.92, LCP about 1.0 s, total blocking time about 0.9 s, script transfer 338 KB (uncompressed, no Caddy in front).

## Not verified here

- Any Docker image build (`apps/web`, `apps/worker`, `apps/whisper`, `ops/Dockerfile.tools`), including the PGDG apt install for `pg_dump` 17. The same steps were run on the host instead.
- Cloudflare R2, the Edge Worker and `wrangler deploy`, the Origin CA, real DNS, a real SMTP provider.
- A real whisper model run, and `ufw`/`setup-vps.sh` on a real VPS.
- `ops/deploy.sh` against real docker and a real registry, and the cron timings.
- Lighthouse against production (behind Caddy with compression and a CDN). The local run is a baseline only.

## Gaps and notes

- Total blocking time on Home is about 0.9 s on the simulated mobile CPU against a target of 0.3 s. The budget in `ops/lighthouse/budget.json` is set just above the baseline and tightened as it improves.
- A restore never targets the live database names. Swapping traffic after a restore is a manual step in the runbook.
- TDD note: for several modules (PWA icons, env file, applier, backup upload and others) the test and the implementation were written in the same step, so the failing run was not observed for them. Later pieces (deploy.sh, compose tools service) were run red first.
