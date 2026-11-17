# Lane K2: video delivery integration

Wires lane D (upload, encode, captions, playback authorization), lane G (player) and lane I (maintenance jobs) into `apps/web` and `apps/worker` with real lane B auth, and proves the whole path with a real end to end run. Decisions D-079 to D-082.

## Routes (apps/web/src/app/api)

All handlers are built in `apps/web/src/server/video/api.ts` (`createVideoApi`) and bound in `server/video/runtime.ts`. Route files are one line wrappers (`server/video/route.ts` adds request id, logging and a clean 500).

| Route | Who | Notes |
| --- | --- | --- |
| `POST /api/play/{id}/session` | signed in viewer (or staff with `{preview:true}`) | same origin check, body `{profileId}`, 401, 403 foreign profile, 404 not available, 429 with `retry-after` |
| `GET /api/play/{id}/{file}` | Bearer token or `?pt=` | `file` is `master.m3u8` or `{height}.m3u8`, anything else 404 |
| `GET /api/hls/keys/{id}` | Bearer token or `?pt=` | 16 raw bytes, 20 per 10 minutes per profile, 300 per minute per IP |
| `POST /api/admin/uploads`, `GET/DELETE /api/admin/uploads/{id}`, `POST .../parts`, `POST .../complete` | editor or admin | the paths lane F's uploader already calls |
| `GET /api/admin/videos/{id}/encoding` | staff | video status, failure message, last 20 jobs (stage, progress, plain error, technical detail), renditions |
| `GET /api/admin/videos/{id}/captions` | staff | tracks with state and latest revision id |
| `POST /api/admin/captions/{id}/approve` | staff | body `{confirmWarnings?}`, 409 with `warnings` when confirmation is needed |
| `POST /api/admin/videos/{id}/publish` | staff | body `{publishAt?, captionOverride?:{reason}}`, 422 with the missing checklist items |
| `GET/PUT /api/dev-storage/{bucket}/{get\|part}`, `GET/HEAD /api/dev-media/{key...}` | signed urls | development with `STORAGE_DRIVER=local` only, 404 otherwise |
| `POST /api/watch/progress` | signed in viewer | the player sink body (seconds, `ended`), converted to milliseconds and sent to lane C `saveProgress`. The player itself now posts to `/api/progress` through K1's adapter, this route stays as the lane G contract |

Auth: `server/auth/request-auth.ts` (`createRequestAuth`, tested with fake sessions) and `server/auth/request-actor.ts` (`getActor`, `getViewer` bound to the runtime). `getActor` needs an active session of an editor or admin that passed the second factor (401 before it, 403 for a viewer). `getViewer` needs an active verified account and reads the signed active profile cookie as a hint. Same origin uses `assertSameOrigin`, client address uses `clientIp` (null without a trusted proxy, then one shared `untrusted` bucket, D-079), limits use the lane B `RateLimiter`.

Watch page: `PLAYBACK_TRANSPORT` is now `http` by default whenever viewer data is real (production always), see `lib/data/playback.server.ts`. `RealPlaybackData` takes a third argument for approved caption tracks and attaches them from the media origin.

Environment for development: `MEDIA_ORIGIN={APP_ORIGIN}/api/dev-media`, `STORAGE_DRIVER=local`, `LOCAL_STORAGE_ROOT` shared by web and worker.

## Worker (apps/worker)

- `registerMaintenanceHandlers` (`maintenance.ts`): `analytics.rollup` (02:00 Africa/Lagos, `runNightlyRollup`), `analytics.prune` (03:00 on the 1st, `pruneViewEvents`), `audit.prune` (03:30 on the 1st, `pruneAudit`). Queue names, definitions and `MAINTENANCE_CRON_SCHEDULES` are in `@ad/queue`; a test pins them to the lane I schedule constants.
- New configuration: `DATABASE_URL_MAINTENANCE` (optional, role `ad_maintenance`; without it the two prunes are skipped with a warning), `WHISPER_FAKE`, `WORKER_SCRATCH_MIN_FREE_RATIO`.
- Migration 0016: `ad_worker` may insert into `audit_log` so the purge can record itself.
- `chooseTranscriber` picks fake, HTTP whisper or a clear permanent error.

## Bugs found by the real run and fixed

1. `DrizzlePlaybackStore.profile` read `profiles` without the account context, so row level security hid every profile from the web role and every viewer session answered 403. It now runs through `withAccount`.
2. The worker refused to start jobs on a disk with less than 15 percent free (the check worked, the sandbox disk is 10 percent free). Now configurable.
3. `seedFirstAdmin` was not exported from `@ad/auth`, so no script could call it.
4. The view of watch data had no captions (K1 gap). Fixed.

## Tests

```
export TEST_DATABASE_ADMIN_URL=postgres://postgres:postgres@localhost:5432/postgres
pnpm vitest run apps/web/src/server/video apps/web/src/server/auth/request-auth.test.ts
pnpm vitest run apps/web/src/server/viewer/watch-progress.int.test.ts apps/web/src/server/data/real-playback.int.test.ts
pnpm vitest run apps/worker packages/queue packages/config packages/video/src/playback
pnpm vitest run apps/web/src/lib/data/playback.server.test.ts
```

## Real end to end run

```
pg_ctlcluster 16 main start
scripts/e2e-video-up.sh 3111          # databases ad_e2e and ad_e2e_keys, migrations, .env.e2e-video, seeded accounts
set -a; . ./.env.e2e-video; set +a
pnpm --filter @ad/worker dev &         # ffmpeg encode, fake captions, maintenance jobs
(cd apps/web && pnpm exec next dev -p 3111) &
E2E_VIDEO=1 E2E_BASE_URL=http://localhost:3111 E2E_CHROMIUM_PATH=/opt/google/chrome/chrome \
  pnpm exec playwright test apps/web/e2e/video-pipeline.e2e.ts --config apps/web/playwright.config.ts
```

The spec signs in as the seeded admin through the real login, generates an 8 second H.264 clip with ffmpeg, uploads it through the API (create, parts through `/api/dev-storage`, complete), polls encoding status until `ready` (renditions all ready), waits for the fake captions to reach review, approves them, sets the checklist items that have no route yet (description, poster, category, kids safe) with SQL, publishes through the API, then a viewer signs in through the real form, creates and selects a profile through the API, opens `/watch/{id}`, plays past 6 seconds (checks the text track and the progress row), and a signed out client gets 401 from the session and key routes. Passed on desktop and mobile projects. Outside the spec, the three maintenance jobs were fired by hand into the real queue and finished under the real roles, and `pgboss.schedule` held all five crons.

## Gaps

- The admin video metadata screens (title, description, poster, categories, kids safe) are still fixtures, so the checklist items other than captions have no route; the spec sets them in SQL. Lane F's screens need to call the new routes.
- Poster and image processing (`image.process`) has no handler, so posters are not generated.
- No cleanup route or screen for failed encodes (`VideoPipeline.retry` exists, no route).
- Audit retention months and legal hold are not read from settings, the prune uses the 24 month default.
- Turnstile, the profile picker UI on real accounts and PIN entry are outside this lane.
- Without `TRUSTED_PROXY_MODE=cloudflare` the per IP key limit is one shared bucket (D-082).
- Not run here: S3 or MinIO (the local driver was used), Cloudflare edge worker, a real faster-whisper model, `next build`.
