# Lane K1: viewer integration

Replaces the lane E fixtures in `apps/web` with real services from `@ad/catalog` and `@ad/viewer`, behind real lane B sessions.

## What is wired

- Catalog, search, home, title and series detail, browse: `apps/web/src/server/data/real-catalog.ts`.
- My List, Continue Watching, progress: `real-library.ts`. Item keys are `video:<uuid>` and `series:<uuid>`.
- Profiles and kids gate: `real-profiles.ts`. The active profile is a signed cookie (`ad_profile`, `__Host-ad_profile` when secure) read by pages and API routes alike. The audience is always derived server side from the stored profile.
- Account stats, playback settings, data export: `real-account-data.ts`, `export-route.ts`, `GET /api/account/export?token=...` (signed, 10 minutes, bound to the account).
- Watch page data: `real-playback.ts`.
- Root layout uses lane H `getRootTheme(nonce)`, with lane I `PwaClient` and `WebVitals` kept.
- Analytics identity: `server/viewer/analytics-identity.ts`, installed by `install-analytics.ts` (lane I `setViewerResolver`).
- Player progress sink posts to `POST /api/progress` through `progressTransport`.
- Migration 0014 adds `profiles.playback_prefs`. `@ad/catalog` gained the `longest` sort and `countTitles`; `@ad/viewer` gained `BrowsePage.total`, `countMyList` and `listMyListRefs`.

## Flags

- `VIEWER_FIXTURES=on`: fixtures for viewer data outside production.
- `AUTH_FIXTURES=on`: fixture auth. Real data needs real auth.
- `ADMIN_THEME_STORE=memory|db`: overrides the theme store. Unset follows real data.
- `PLAYBACK_TRANSPORT=http`: real progress transport. Production forces it.
- Production always uses real services. No flag turns fixtures on there.

## Tests

Integration tests need `TEST_DATABASE_ADMIN_URL=postgres://postgres:postgres@localhost:5432/postgres`.

- `pnpm vitest run apps/web/src/server/data/real-catalog.int.test.ts` (and real-library, real-profiles, real-account-data, real-playback)
- `pnpm vitest run apps/web/src/server/viewer/analytics-identity.int.test.ts`
- `pnpm vitest run apps/web/src/server/data/mappers.test.ts apps/web/src/server/data/export-route.test.ts`

End to end smoke, against a dev server with real Postgres and a seeded demo catalogue (`pnpm db:seed:demo`):

`E2E_REAL=1 E2E_SMTP_PORT=2525 E2E_BASE_URL=http://localhost:3411 pnpm exec playwright test apps/web/e2e/viewer-real.e2e.ts --config apps/web/playwright.config.ts --project=desktop`

The spec starts a small SMTP sink to read the verification code. It covers sign up, verify, profile creation, Home, My List, Continue Watching and resume, the signed out redirect, and cross account API denial. Existing fixture specs now need `VIEWER_FIXTURES=on AUTH_FIXTURES=on`. Repeated local runs hit the sign up rate limit; clear it with `delete from rate_limit_buckets`.

## Gaps

- The 14 day deletion grace period is not built. D-059 makes deletion immediate. A grace period needs an account status, a purge job and cancel on sign in.
- Export is on demand behind a signed link. No emailed link, no background job, no password confirm, no one per 24 hours rule.
- Lane D playback session routes and HLS keys are not wired. Captions are empty. The fixture sample stream is used unless `PLAYBACK_TRANSPORT=http`.
- Cards carry no category or publish date.
- Continue Watching undo uses an in process stash that lasts 5 minutes.
- The UI has no PIN entry, so selecting a PIN protected profile throws.
- Site content and legal pages are still fixtures. Home has no h1. PWA icons are defaults.
