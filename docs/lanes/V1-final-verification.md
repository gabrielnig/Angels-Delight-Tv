# V1 final verification of main

Run on main after lanes R1, R2, R3, F1, F2, P1, P3, F3 and Q1 merged. One file or package at a time, never the full unit suite.

## Setup

- Install, typecheck (`pnpm typecheck`), lint (`pnpm lint`, `eslint .`), `pnpm --filter @ad/web build`.
- Postgres: `pg_ctlcluster 16 main start`, `TEST_DATABASE_ADMIN_URL=postgres://postgres:postgres@localhost:5432/postgres`.
- Fixture server (port 3112): `scripts/ci-fixture-env.sh 3112 > .env.ci-fixture`, then `NODE_ENV=development next start -p 3112` from `apps/web` with that environment loaded.
- Real stack (port 3111): `scripts/e2e-video-up.sh 3111`, `pnpm db:seed:demo`, the worker (`pnpm --filter @ad/worker dev`) and `NODE_ENV=development next start -p 3111`, both with `.env.e2e-video` loaded. On this machine free disk is under 5 percent, so the worker was started with `WORKER_SCRATCH_MIN_FREE_RATIO=0.02` (the e2e default of 0.05 fails the encode with `out_of_disk`).
- `E2E_CHROMIUM_PATH=/opt/google/chrome/chrome`, `--workers=1`, both projects (mobile 360 by 740 and desktop).
- The real specs need `.env.e2e-video` loaded in the shell that runs Playwright (`E2E_DATABASE_ADMIN_URL`), plus `E2E_VIDEO=1`, `E2E_REAL=1 E2E_SMTP_PORT=1025` or `E2E_THEME=1 E2E_SMTP_PORT=1025`. Truncate `rate_limit_buckets` in `ad_e2e` between viewer-real and theme-publish.

## Pass table

| Check | Result |
|---|---|
| `pnpm install`, `pnpm typecheck`, `pnpm lint` | pass (typecheck needed two fixes, below) |
| `next build` | pass |
| Unit and integration, by package: shared 51, config 36, storage 53 (17 skipped, moto not installed), db 80, analytics 73, audit 57, auth 235, catalog 145, launch 173 (1 skipped), mailer 134, player 305, queue 75, security 41, theme 434, ui 209, video 328, viewer 219, apps/edge 22, apps/worker 57, scripts 73 | pass (DB backed tests included) |
| apps/web by folder: app 35, components 608, features 49, lib 555, server 303, proxy 2 | pass |
| `auth-pages` | 30 pass |
| `home` | 6 pass |
| `title-parity` | 12 pass, 2 skipped by design (viewport specific) |
| `account-pages` | 24 pass (10 consecutive runs) |
| `account-states` | 24 pass (8 consecutive runs) |
| `picker-cache-3g` | 4 pass |
| `a11y` (every page including `/admin/account`) | 104 pass, 0 fixme |
| `touch-targets` | 8 pass |
| `admin-upload` | 10 pass |
| `video-pipeline` (real stack) | 2 pass |
| `viewer-real` (real stack) | 12 pass |
| `theme-publish` (real stack) | 1 pass, 1 skipped by design (desktop only) |
| `scripts/footprint-check.sh` | clean |
| Em dash, en dash and emoji grep over all tracked files | none left (test literals now unicode escapes) |

## Real failures found and fixed (each a small PR, root cause)

1. Typecheck was red: `messages.test.ts` used ad hoc keys against the typed translator, and `s3rver` had no types (`packages/storage/src/s3rver.d.ts`).
2. `ffmpeg.int.test.ts` expected three poster candidates; the pipeline makes six since M36-S01, and the variants come from the queued `image.process` job, so the test now reads the raw candidate.
3. `theme.test.ts` fixture expectation: default heading font is Space Grotesk.
4. `account.int.test.ts`: resetting another person's two factor needs `roles.change`, which the can matrix gives to the Super admin only. The test now uses a super admin and checks a plain admin is refused.
5. Product bug, phones: the playback settings loading skeleton overflowed 360px by 25px (`.acct-skel-line` lacked `min-width: 0`).
6. Product bug, 320px admin: `/admin/videos/trash` overflowed by 25px on first load because the visually hidden table text (`.adm-sr`, absolute) had no positioned ancestor inside the table card. `.adm-table-card` is now `position: relative`.
7. Product bug, styling: `.adm-detail` in `admin.css` was never closed, so the cue and bell rules after it were nested under it and did not apply.
8. Product bug, real data: Home returned the error page in a production build because `safePlaceholderBlur` was exported from a `use client` module and called by `server/data/mappers.ts`. The pure functions moved to `packages/ui/src/components/placeholder-safe.ts` (with a test that the file stays a plain module). Only found on the real stack, fixtures do not map posters.
9. Spec races, not product bugs: the account page specs raced the loading fallback (it renders the same heading and is swapped out), typed before hydration, and ran axe mid colour transition. They now wait for the settled state.

## Gaps and notes

- `pnpm format:check` reports 78 files not in Prettier style (mostly tests and CSS written before the check was enforced). Not part of this gate and not changed here.
- Storage contract against moto stays skipped (moto is not installed here).
- The watch page copy uses the arrow glyph in "Back"; it is a typographic arrow, not an emoji.
- Not run: GitHub Actions itself, Lighthouse, WebKit and real devices.
