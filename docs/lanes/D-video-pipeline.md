# Lane D: Video pipeline

Modules M13 upload, M14 encoding, M15 captions, M31 playback authorization, M30 queue helpers, M22 storage lifecycle. Packages `@ad/video`, `@ad/queue`, `apps/whisper`, `apps/edge`, handlers in `apps/worker`.

## Wiring still needed in apps/web (lane B session code)

Handlers take injected functions, so route files are one line wrappers. Not wired yet: `getActor`, `getViewer`, `assertSameOrigin`, `clientIp`, the shared `RateLimiter`, a Drizzle `DrizzlePlaybackStore`, and a `JobProducer` built on `createProducerBoss`. Dev only routes: `/api/dev-storage/{bucket}/{get|part}` uses `createDevStorageHandler`, `/api/dev-media/{key...}` uses `createDevMediaHandler`. Set the media origin to `{APP_ORIGIN}/api/dev-media` in development.

## For lane F (admin upload and processing screens)

Upload handlers: `createUploadHandlers({service, getActor, assertSameOrigin})` returns `create`, `describe`, `parts`, `complete`, `abort`.
- `create` body `{name, size, type, fingerprint, replaceVideoId?}` returns the session state with `resumed` and `duplicateOf`. Same fingerprint resumes.
- `describe` returns `uploadedParts` so the browser can skip finished parts. `parts` returns presigned part urls. `complete` returns 409 with `missing` part numbers when parts are absent. Completing queues `video.probe`.
- Errors use `{error:{code,message,fields?}}` with 401, 403, 404, 409, 422, 429.

Processing state: `jobs` rows carry `queue`, `status`, `stage`, `progress`, `error_message` (plain language), `error_detail` (technical, staff only), `heartbeat_at`. `videos.status` goes `uploading`, `processing`, `ready` or `failed`, with `failure_code` and `failure_message`.
- `VideoPipeline.retry(videoId, createdBy)` requeues probe. `VideoPipeline.rewrapKey` backs the `video.rekey` job.
- `CaptionService`: draft list, `getRevision`, `saveRevision`, `approve`, `reject`, `importFile`, `exportVtt`, generate (queues `caption.generate`, may throw `CaptionNeedsConfirmation` for long videos).
- `PlaybackService.startPreview(actor, videoId)` via `POST /api/play/{id}/session` with `{preview:true}` gives a staff preview token (1 hour, no profile).

## For lane G (player)

- `POST /api/play/{id}/session` body `{profileId}` returns `{token, expiresAt, masterUrl, captions:[{language,label,isDefault,url}], preview}`. 401 not signed in, 403 foreign profile or cross site, 404 not available (unpublished, deleted, hidden from kids), 429 rate limited with `retry-after`. Lane G docs mention 410, the server uses 404.
- `GET /api/play/{id}/master.m3u8` and `GET /api/play/{id}/{height}.m3u8`: `Authorization: Bearer {token}`, or `?pt={token}` for native HLS (the rewritten playlists then carry `pt` on child urls and the key url).
- `GET /api/hls/keys/{id}`: 16 raw bytes, `no-store`. Limits: 20 per 10 minutes per profile, 300 per minute per IP.
- Segments and captions come from the media origin. Segment urls are signed and last 6 hours. Playlists are `private, no-store` with `referrer-policy: no-referrer`.
- Tokens last 30 minutes, so the player must mint a new session before expiry and swap the Bearer.

## Queues (`@ad/queue`)

`video.probe`, `video.encode`, `video.thumbnails`, `caption.generate`, `video.rekey`, `video.purge`, `uploads.cleanup` (hourly), `videos.purge_deleted` (03:30 Africa/Lagos). Payloads carry ids only. Permanent failures finish the job and mark the mirror row `failed_permanent` (D-029). `image.process` has no handler here.

## Configuration

`HLS_KEK`, `HLS_KEK_PREVIOUS`, `MEDIA_URL_SECRET`, `PLAYBACK_TOKEN_SECRET(_PREVIOUS)`, `MAX_VIDEO_SECONDS`, `FFMPEG_PRESET`, `FFMPEG_THREADS`, `WORKER_SCRATCH_DIR`, `WHISPER_URL`. The ladder defaults to `DEFAULT_LADDER` and can be overridden by the `video.ladder` setting. Edge secrets are set with `wrangler secret put`, see `apps/edge/wrangler.toml`.

## Scoped tests

- `pnpm vitest run packages/video/src/playback` and `packages/video/src/lifecycle` (the latter needs `TEST_DATABASE_ADMIN_URL`).
- `pnpm vitest run packages/video/src/encode/ffmpeg.int.test.ts` (skips without ffmpeg).
- `pnpm vitest run apps/edge`, `apps/worker/src/handlers.test.ts`, `packages/queue`.
- `python3 -m unittest` in `apps/whisper` (script `test:py`).

## Gaps

- Auth wiring and route files in `apps/web` (above).
- Low confidence cues from Whisper are not persisted. Forced alignment of a script is a stub (`alignScript`).
- Sprite sheet thumbnails are skipped. Orphan multipart uploads that have no session row are not listed.
- Poster and hero asset files are not removed on purge.
- Long video warning is derived from `durationMs`.
