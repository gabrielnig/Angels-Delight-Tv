# Platform stories audit (lane a3)

Independent audit of every Must and Should story for modules M08 and M11 (playback), M21 to M24, M26, M31 to M33 and M36 against the code and tests on `main`. Lane notes were not trusted: each row was checked in the code. Could stories are not audited (M08-S29, M11-S03, M11-S04, M21-S05, M26-S06, M32-S04, M36-S04); M11-S03 caption styling was built anyway and is noted below. Owners: lane m1 owns deploy, backups and the launch kit, lane m3 owns image processing, sprites and M36, so rows for those are marked `m1` or `m3` and were not worked here.

Status rules: **done with test** means every acceptance criterion is implemented and proven by a test (small items without a test are named in the gap column). **done without test** means the code exists but at least one criterion has no test. **partial** means a criterion is not implemented. **missing** means nothing implements the story. Run scoped tests with `pnpm vitest run <path>`. Browser proof needs `E2E_CHROMIUM_PATH=/opt/google/chrome/chrome` and `pnpm --filter @ad/web test:e2e:hls`.

| Story | Priority | Status | Evidence | Gap |
|---|---|---|---|---|
| M08-S01 Start playback | Must | done with test | controller.test.ts (resume, autoplay blocked, low data 360p); hlsEngine.test.ts; controller.telemetry.test.ts (startup); apps/web/e2e/hls-real.stack.ts (real hls.js plays AES-128) | Shell under 1 second has no budget test (Lighthouse covers Home only) |
| M08-S02 Play and pause | Must | done with test | PlayerView.test.tsx (click, keys); PlayerView.chrome.test.tsx (touch); controller.test.ts (write on pause and hide) |  |
| M08-S03 Seek bar and time | Must | done with test | SeekBar.test.tsx; PlayerView.test.tsx (arrows, time toggle, slider text); controller.seek.test.ts (retry once, then segment start) | Home and End keys asserted in keyboard.test.ts only |
| M08-S04 Double tap seek | Should | done with test | gestures.test.ts; PlayerView.test.tsx (+10) |  |
| M08-S05 Volume and mute | Must | done with test | controller.test.ts (5 percent steps, stored mute); PlayerView.test.tsx (phone sheet, no slider); PlayerView.chrome.test.tsx and hls-real.stack.ts (silent video hides volume) |  |
| M08-S06 Full screen and orientation | Must | done with test | PlayerView.chrome.test.tsx (F, double click, landscape lock and release, iOS native); PlayerView.test.tsx (refusal toast) |  |
| M08-S07 Controls auto hide | Must | done with test | PlayerView.chrome.test.tsx (3 s, cursor, focus, reduced motion) |  |
| M08-S08 Keyboard shortcuts | Must | done with test | keyboard.test.ts; PlayerView.test.tsx (help dialog, inputs ignored) |  |
| M08-S09 Touch controls and tap targets | Must | done with test | hls-real.stack.ts (360 px phone: every control at least 44 px, 8 px apart, seek hit area 32 px); PlayerView.chrome.test.tsx (stylesheet: touch token, safe areas) | Browser test is not in CI (needs Chrome) |
| M08-S10 Playback speed | Must | done with test | controller.test.ts (speeds, persistence, pitch kept); PlayerView.test.tsx (menu) | Unsupported speed toast not built (all target browsers support 0.5x to 2x) |
| M08-S11 Quality menu | Must | done with test | quality.test.ts; PlayerView.test.tsx (rungs, data saver hint, single rung hidden); hlsEngine.test.ts (lock, cap) |  |
| M08-S12 Captions control | Must | done with test | controller.test.ts (approved only, toggle, toast on failure); PlayerView.test.tsx (hidden without tracks) |  |
| M08-S13 Autoplay next | Must | done with test | controller.test.ts (countdown, cancel, off, no next); PlayerView.test.tsx (cards, finished series) | AC5 data saver prefetch holds by construction (nothing is prefetched), no test |
| M08-S14 Up next tile | Should | done with test | controller.test.ts; PlayerView.test.tsx |  |
| M08-S15 Resume | Must | done with test | resume.test.ts; controller.test.ts (toast, Start over); start-at.test.ts |  |
| M08-S16 Progress reporting | Must | done with test | progress.test.ts (interval, flush, beacon, offline newest only, 401 and 403); apps/web/src/features/player/progress-body.test.ts; packages/viewer/src/progress.int.test.ts (server limit) | Interval is 15 s (D-043), server limit is 30 per minute not 1 per 5 s (D-123). 403 to picker is wired in WatchClient with no test |
| M08-S17 Buffering indicators | Must | done with test | controller.test.ts (500 ms spinner, 8 s notice, 20 s recovery, rebuffer count) |  |
| M08-S18 Poor network adaptation | Must | done with test | hlsConfig.test.ts; bandwidth.test.ts (seeded estimate); quality.test.ts (data saver cap) | Late segment drop rule is hls.js ABR, not asserted |
| M08-S19 Picture in picture, lock screen | Should | done with test | PlayerView.test.tsx (PiP button, toast, Media Session) |  |
| M08-S20 Network error recovery | Must | done with test | hlsConfig.test.ts (3 retries 1, 2, 4 s); controller.test.ts (drop rung, Connection lost, online retry) |  |
| M08-S21 Expired URL and key refresh | Must | done with test | token.test.ts; controller.test.ts (refresh once, 401, gone); hls-real.stack.ts (expired segment url recovers, seek storm makes at most 10 key requests) |  |
| M08-S22 Unsupported format | Must | done with test | controller.test.ts (lower rung then cannot play, unsupported browser); hlsEngine.test.ts | Help link target is the Help page |
| M08-S23 Video not found or removed | Must | done with test | controller.test.ts; hls-real.stack.ts (unpublished video shows no longer available); apps/web watch route tests |  |
| M08-S24 Offline in the player | Must | done with test | controller.test.ts (offline pause, resume, offline open); WatchClient.test.tsx (Offline screen) |  |
| M08-S25 Player accessibility | Must | done with test | PlayerView.test.tsx (names, tab order, slider text, live region); PlayerView.chrome.test.tsx (reduced motion) |  |
| M08-S26 Watch page layout | Must | done without test | apps/web/src/features/player/watch.css (16:9 box, landscape rule); WatchServerParts.test.tsx (content) | Layout rules (column, phone portrait and landscape) have no test |
| M08-S27 Poster and first frame | Should | done with test | PlayerView.chrome.test.tsx (poster fade within 200 ms, dark box on failure); controller.test.ts (spinner after 500 ms) |  |
| M08-S28 End screen | Must | done with test | PlayerView.test.tsx (Replay, My List, finished series); controller.test.ts (finished) |  |
| M08-S30 Player quality metrics | Should | done with test | controller.test.ts (metrics sink every 60 s); apps/web/src/features/player/telemetry.test.ts (startup, errors, rebuffer delta); ingest.test.ts | Average bitrate is reported to the sink but not stored |
| M08-S31 Resume across devices | Should | done with test | packages/viewer/src/progress.int.test.ts (later write wins); real-playback.int.test.ts |  |
| M11-S01 Load approved captions only | Must | done with test | controller.test.ts (approved only, toast); PlayerView.test.tsx; apps/web e2e caption journeys | AC3 caption urls are unsigned by decision (L-4, D-089) |
| M11-S02 Caption toggle and persistence | Must | done with test | controller.test.ts (remembers, starts on or off); preferences.test.ts |  |
| M11-S05 Caption badge on titles | Should | done with test | WatchServerParts.test.tsx; card and title tests in packages/ui and apps/web | Per episode badge in a series has no test |
| M11-S06 Captions positioning and legibility | Must | done with test | captions-css.test.ts (16 px, dark background, above controls) | 2 line wrap is the browser default, no test |
| M11-S07 Captions with speed and seeking | Must | done without test | Browser text track follows the media clock | No test for the 200 ms cue after seek |
| M21-S01 Send transactional email reliably | Must | partial | packages/mailer delivery.test.ts (5 attempts with backoff, no retry on 5xx, outage alert after 10 min, suppression); templates.test.ts (size under 30 KB, no pixels); apps/web/src/server/email/webhook.test.ts and suppression.int.test.ts (signed bounce, hashed list) | `f1`: staff notification mail now uses `email_outbox` with retry, provider message id and status (D-129, `packages/queue/src/outbox.int.test.ts`). Sign in and account mail is still sent in the request (D-122, D-129), so its provider message id is not recorded |
| M21-S02 Email templates | Must | done with test | templates.test.ts (all templates, code not in subject, missing variable fails, no dashes or emojis); mailer.test.ts; signup.int.test.ts (welcome) |  |
| M21-S03 Admin notices | Should | done with test | packages/video/src/notices.int.test.ts (also as the worker role); NoticeBell.test.tsx; apps/web/src/lib/data/admin/notices.test.ts; `f1`: packages/queue/src/digest.int.test.ts (at once, hourly, daily at 07:00 Lagos, 50 line cap), outbox.int.test.ts (batching, retry), apps/worker/src/mail.test.ts | Immediate means within a minute (the drain runs every minute) |
| M21-S04 Email deliverability setup | Must | done with test | docs/DEPLOYMENT.md lists SPF, DKIM, DMARC; `f1`: packages/launch/src/dns/check.test.ts (SPF, DKIM, DMARC, app domain, media domain, offline with an injected resolver); `pnpm dns:check`; docs/LAUNCH-RUNBOOK.md step 1 and the smoke checklist | Inbox placement is a manual smoke step. A proxied app domain cannot be compared with the VPS address (D-133) |
| M22-S01 Bucket layout and CDN domain | Must | done with test | packages/storage contract suite; apps/edge/src/worker.miniflare.test.ts (CORS for the app origin only); apps/edge/src/smoke.test.ts (deploy smoke for CORS and signatures, `pnpm edge:smoke`) | Smoke is not yet in deploy.sh (`m1`) |
| M22-S02 Presigned upload URLs | Must | done with test | packages/storage/src/s3.server.test.ts (S3 driver over HTTP against s3rver and moto, multipart resume); packages/video upload tests | Real R2 stays a launch check |
| M22-S03 Storage usage and lifecycle | Should | done with test | apps/web/src/lib/data/admin/real/system.int.test.ts (usage by type, estimate, 80 percent warning); system-rules.test.ts (storageBudget); SystemView.test.tsx (warning, Not available) | `f1`: the budget is the `limits.storage_cap_bytes` setting (D-131). The 7 day multipart rule is an R2 setting in DEPLOYMENT, not code |
| M23-S01 Password and session security | Must | done with test | packages/auth hasher, sessions and signin.int.test.ts |  |
| M23-S02 Security headers and CSRF | Must | done with test | apps/web/src/proxy.test.ts; scripts/check-headers.test.ts; csp-report.test.ts; same origin tests in server routes |  |
| M23-S03 Rate limiting | Must | done with test | packages/security/src/rate-limit.int.test.ts (fail closed and open); api-limit.test.ts (429 and Retry-After) |  |
| M23-S04 Input validation and uploads | Must | done with test | schema tests per route; packages/video/src/image/process.test.ts (re-encode, strip); upload tests (server side keys) | Unknown field rejection is per schema, not asserted everywhere |
| M23-S05 Dependency and secrets hygiene | Should | done with test | scripts/ci-workflow.test.ts (audit, secret scan, SAST); secret-scan.test.ts; docs/DEPLOYMENT.md section 12 | Separate R2 keys are a launch setting |
| M24-S01 Logs and request ids | Must | done with test | with-request.test.ts; request-id.test.ts; error.test.tsx (Reference) |  |
| M24-S02 Health checks and alerts | Must | partial | healthz.test.ts (/healthz, /readyz); worker-health.test.ts and heartbeat.int.test.ts (worker silent 5 min gives 503) | Disk, error rate and certificate alerts, dedupe and email and push are monitor settings in DEPLOYMENT section 9, not code (`m1`) |
| M24-S03 Error tracking | Should | done with test | error-reporter.test.ts; request-error.test.ts (pages and actions, route template, request id) | Client side errors are counted by code only, no stack |
| M24-S04 Player quality dashboard | Should | done with test | analytics.int.test.ts (p50, p75, rebuffer ratio, errors); SystemView.test.tsx (quality tab) | Rendition distribution and device filter are not shown |
| M26-S01 Legal pages | Must | done with test | legal-html.test.ts; LegalView.test.tsx; real-site tests; SignUpForm links to Terms and Privacy | Offline readability of legal pages not tested |
| M26-S02 Edit pages in admin | Should | done with test | packages/theme/src/settings-service.test.ts (sanitise, versions, restore, audit) |  |
| M26-S03 About, Contact and Help | Should | done without test | apps/web/src/app/(site)/about and help pages | No render tests for the Help answers |
| M26-S04 Error pages | Must | done with test | not-found.test.tsx; error.test.tsx (Reference, Try again, Back to Home) | Offline cache of these pages not tested |
| M26-S05 Viewer settings hub | Should | done with test | PlaybackSettings.test.tsx; account layout tests | Kids profile block is covered in a1 audit |
| M31-S01 Signed playlist | Must | done with test | packages/video/src/playback/service.test.ts (2 hour urls, kids, hidden, foreign profile); http.test.ts |  |
| M31-S02 HLS key endpoint | Must | done with test | http.test.ts (no-store, denial log, 401 and 403); hls-real.stack.ts (key route over real hls.js); publishing.int.test.ts (key required) | 403 is 401 for missing tokens (D-121). Limit is 20 per 10 min per profile (D-123) |
| M31-S03 Segment access control | Must | done with test | apps/edge worker.miniflare.test.ts (workerd); hls-real.stack.ts (expired url); smoke.test.ts (misconfiguration) | Token is per url signature over the key, not a path prefix cookie (D-047) |
| M31-S04 Preview tokens for admin | Should | done with test | service.test.ts (previews need staff); http.test.ts (staff actor); preview 1 hour | Preview analytics drop is covered in a2 audit |
| M32-S01 Nightly backups | Must | done with test | `m1`: packages/launch/src/backup run.test.ts, retention.test.ts; ops/backup.sh at 03:00 Lagos. `f1`: manifest.test.ts (size and checksum), run.test.ts (manifest written, 14 daily plus 8 weekly over 100 nights), restore.int.test.ts (tampered backup refused) | The keys database keeps 14 daily only (D-132) |
| M32-S02 Restore drill | Must | partial | `m1`: restore.int.test.ts | Quarterly drill date record and failed drill issue are process steps |
| M32-S03 Account deletion purge | Should | done with test | packages/auth/src/account.int.test.ts (grace, cancel, purge, hashed audit) | Backup ageing text on Privacy page is client content |
| M33-S01 Reproducible deploy | Must | partial | `m1`: ops/deploy.sh, compose-prod.test.ts, ops-deploy.test.ts | No image build, push and rollback pipeline in CI; version in admin footer not asserted |
| M33-S02 CI checks | Must | done with test | scripts/ci-workflow.test.ts (lint, typecheck, scoped tests, footprint dash and emoji grep, secret scan, build, Semgrep, SBOM); footprint-check.test.ts | Failures block merging only once branch protection is on |
| M33-S03 Domain and HTTPS | Should | partial | `m1`: Caddyfile tests, DEPLOYMENT section 4 | Certificate expiry alert is a monitor setting |
| M36-S01 Generate poster candidates | Must | partial | `m3`: packages/video/src/encode/pipeline.ts (3 candidates, best effort); PosterPicker.test.tsx | Story asks for 6 frames with a blur and black frame score and a low score warning |
| M36-S02 Responsive image variants | Must | partial | `m3`: packages/video/src/image/process.test.ts, service.int.test.ts (WebP and JPEG, hashed paths, immutable) | No AVIF, no 1 KB blur placeholder (a colour is stored), widths differ from 320, 640, 960 |
| M36-S03 Hero image and focus point | Should | partial | `m3`: process.test.ts (crop follows focus) | No focus point tool or safe area guide in admin |

## Counts

Rows: 69. done with test: 58. done without test: 3. partial: 8. missing: 0.

m1 and m3 had not merged when this table was written. Their rows (M21-S04, M24-S02 alerts, M32, M33-S01, M33-S03, M36) must be re-checked against their merged work.

## Signed url lifetime review (L-3, L-4)

L-3: segment urls are back to 2 hours (D-120), proven by a real browser: an expired url answers 403 from the real edge Worker, hls.js asks for a fresh session and plays on with nothing shown. L-4: `cap/` and `img/` stay unsigned (D-089 unchanged). Caption and image keys carry an 80 bit random prefix or a content hash, the Worker test proves they answer without a signature, and the residual is that a caption url stays valid until its files are deleted. Revisit if captions ever hold private content.
