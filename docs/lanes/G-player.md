# Lane G: Player (M08, M11)

## What exists
- `packages/player` (`@ad/player`): framework free `PlayerController` state machine, `ProgressReporter`, `TokenManager`, resume, quality, keyboard, tap gesture logic, hls.js and native engines behind `PlayerEngine`, React `Player` and `PlayerView`, HTTP session and progress adapters, `player.css` (tokens only). Fakes for tests at `@ad/player/testing`.
- `apps/web`: `/watch/[videoId]` (S21, S22) with not found and kids blocked states, details, up next tiles, offline screen. Data access: `src/lib/data/playback.ts` (interface), `playback.fixture.ts`, `playback.server.ts` (swap point). Client wiring in `src/features/player`.
- `scripts/make-sample-hls.sh`: ffmpeg generates plain and AES-128 (ad-key://sample) samples into `apps/web/public/fixtures/hls` (git ignored).

## Tests (scoped)
- `pnpm vitest run packages/player`
- `pnpm vitest run apps/web/src/features/player apps/web/src/lib/data/playback.fixture.test.ts`
- Smoke: `scripts/make-sample-hls.sh`, start `pnpm --filter @ad/web dev -p 3111`, then `E2E_BASE_URL=http://localhost:3111 E2E_CHROMIUM_PATH=/opt/google/chrome/chrome pnpm exec playwright test apps/web/e2e/watch.e2e.ts --config apps/web/playwright.config.ts`. The sample is H.264, so bundled Chromium skips the spec; use Chrome. 17 pass, 3 intentional skips.

## Integration contract (for the wiring pass)
- Session: `POST /api/play/{videoId}/session` body `{profileId}` returns `{token, expiresAt (ISO or epoch), masterUrl}`. 401 sign in, 403/404/410 removed, 429 rate limited.
- Progress: `POST /api/watch/progress` JSON `{videoId, profileId, positionSeconds, durationSeconds, ended}`, idempotent, also reached by sendBeacon.
- Set `PLAYBACK_TRANSPORT=http` and replace the fixture in `playback.server.ts`. Routes to confirm are in `features/player/routes.ts` (sign in, browse, search, help, playback settings).
- Variant playlists must carry the key URI as https app route (lane D does) and `pt` for native HLS.

## Gaps
- Seek preview sprites (S29), seek failure retry (S03 error), poster fade (S27), kids speed limit, remember quality, Still watching prompt, caption style options (M11-S03).
- Server side per profile preferences; media session artwork sizes; no CDN or edge worker integration tested.
- Memoise `initialSession` if passed to `Player`, a new object recreates the player.
- apps/web `next build` not run here.
