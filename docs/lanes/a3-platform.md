# Lane a3: platform stories audit and gap fixes

Audit table: `docs/audits/stories-platform.md`. Decisions: D-120 to D-124.

## What exists
- Player: seek retry and segment fallback, poster fade, caption style (`captionStyle.ts`, per profile background and contrast), bandwidth seed, telemetry and rebuffer reports, pitch kept.
- Real browser journey: `apps/web/e2e/support/real-hls-stack.ts` (ffmpeg, real AES-128, real playback routes, edge Worker in Miniflare). Tests in `apps/web/e2e/hls-real.stack.ts`.
- Edge: `apps/edge/src/worker.miniflare.test.ts` (workerd), `smoke.ts` and `pnpm edge:smoke <media> <app>` for deploys.
- Storage: `packages/storage/src/s3.server.test.ts` against s3rver always and moto_server (set `MOTO_SERVER`) or `S3_TEST_ENDPOINT` for multipart.
- Email: `RetryingTransport`, `OutageMonitor`, welcome template, `/api/webhooks/email` (needs `EMAIL_WEBHOOK_SECRET`), `email_suppressions` (migration 0028).
- Ops: `worker_heartbeats` (migration 0030), `/api/health/worker`, `onRequestError` reporting, CI build, Semgrep (`pnpm sast`) and SBOM (`pnpm sbom`).

## Scoped tests
- `pnpm vitest run packages/player packages/mailer packages/queue/src/heartbeat.test.ts apps/edge scripts apps/web/src/features/player apps/web/src/server/email`
- DB: `TEST_DATABASE_ADMIN_URL=postgres://postgres:postgres@localhost:5432/postgres pnpm vitest run packages/auth/src/signup.int.test.ts packages/queue/src/heartbeat.int.test.ts apps/web/src/server/email`
- Browser: `E2E_CHROMIUM_PATH=/opt/google/chrome/chrome pnpm --filter @ad/web test:e2e:hls`

## Gaps
See the gap column of the audit. Main ones: email outbox and provider ids, DNS check script (m1), backup manifest and retention shape (m1), image variants and poster scoring (m3), alert settings in the monitor, base image digests and Trivy at release.
